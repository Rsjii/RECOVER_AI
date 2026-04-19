import crypto from 'crypto';
import { config } from '../config/env';
import { DunningEmailJob } from '../types/email';
import { createEmailLog } from '../db/emailLogs';
import { findCompanyById } from '../db/companies';  // P0: Get reply-to email
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import aiService from './aiService';
import resendService from './resendService';
import { sendViaSmtp } from './smtpService';

const LOG_MODULE = 'emailService';

export interface SendResult {
  success: boolean;
  sendgridMessageId?: string;
  emailLogId?: string;
  error?: string;
}

class EmailService {
  /**
   * Send a dunning email via SendGrid.
   * Uses AI to generate personalized subject + body.
   * Logs to email_logs table on success.
   */
  async sendDunningEmail(job: DunningEmailJob): Promise<SendResult> {
    const method = 'sendDunningEmail';

    // DEV MODE: Don't send real emails in development
    if (config.nodeEnv === 'development') {
      logInfo(LOG_MODULE, method, 'DEV MODE: Email not sent (check logs instead)', {
        to: job.recipientEmail,
        subject: `Invoice ${job.invoiceId} - ${job.emailType}`,
        invoiceId: job.invoiceId,
        emailType: job.emailType,
        daysOverdue: job.daysOverdue,
      });
      return { success: true, sendgridMessageId: 'dev-mode-' + Date.now() };
    }

    logInfo(LOG_MODULE, method, 'Generating email content', {
      invoiceId: job.invoiceId,
      emailType: job.emailType,
      daysOverdue: job.daysOverdue,
    });

    if (!config.resend.apiKey) {
      logError(LOG_MODULE, method, 'RESEND_API_KEY not configured');
      return { success: false, error: 'Resend not configured' };
    }

    if (!config.resend.fromEmail) {
      logError(LOG_MODULE, method, 'RESEND_FROM_EMAIL not configured');
      return { success: false, error: 'Sender email not configured' };
    }

    try {
      // 1. Fetch company for reply-to, company name, and SMTP fallback control (early, needed for AI generation)
      let replyTo: string | undefined;
      let companyName = 'Your Company';
      let smtpFallbackToResend = false;
      try {
        const company = await findCompanyById(job.companyId);
        replyTo = company?.reply_to_email || undefined;
        companyName = company?.name || 'Your Company';
        smtpFallbackToResend = company?.smtp_fallback_to_resend || false;
      } catch { /* non-critical */ }

      // 2. Generate personalized email via AI
      const generated = await aiService.generateDunningEmail({
        customerId: job.customerId,
        invoiceId: job.invoiceId,
        customerName: job.customerName,
        invoiceAmount: job.invoiceAmount,
        dueDate: job.dueDate,
        daysOverdue: job.daysOverdue,
        riskScore: job.riskScore,
        previousReminders: job.attemptNumber - 1,
        companyName: companyName,
        paymentLink: job.paymentLink,
      }, job.companyId);

      // 3. Pre-generate email log ID so we can inject tracking pixel before sending
      const emailLogId = crypto.randomUUID();
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      const frontendUrl = config.frontendUrl || 'http://localhost:5173';

      // 4. Inject tracking pixel + unsubscribe footer (CAN-SPAM / GDPR compliance)
      const trackOpenUrl = `${backendUrl}/api/email/track/open?logId=${emailLogId}`;
      // Generate HMAC-SHA256 signed token (cryptographic, not just base64)
      const unsubData = `${job.recipientEmail}:${job.companyId}`;
      const hmac = crypto.createHmac('sha256', config.jwtSecret || 'fallback-secret');
      hmac.update(unsubData);
      const unsubToken = hmac.digest('hex');
      const unsubUrl = `${frontendUrl}/unsubscribe?token=${unsubToken}&email=${encodeURIComponent(job.recipientEmail)}&company=${job.companyId}`;

      const bodyHtmlWithTracking = (generated.bodyHtml || '') +
        `<img src="${trackOpenUrl}" width="1" height="1" style="display:none" alt="" />` +
        `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">` +
        `You receive these emails because you have an outstanding balance. ` +
        `<a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe</a> to stop payment reminders.</div>`;
      const bodyTextWithFooter = (generated.bodyText || '') +
        `\n\n---\nTo unsubscribe from future emails: ${unsubUrl}`;

      // 5. Try SMTP first (Option A: client's own email server), fallback to Resend (Option C)
      let sendResult = await sendViaSmtp(
        job.companyId,
        job.recipientEmail,
        generated.subject,
        bodyHtmlWithTracking,
        replyTo
      );

      if (!sendResult.success) {
        // SMTP failed or not configured
        // Check if SMTP is actually configured: if error is NOT "SMTP not configured", then it IS configured
        const smtpIsConfigured = sendResult.error !== 'SMTP not configured';

        if (smtpIsConfigured && !smtpFallbackToResend) {
          // SMTP is configured but failed, and fallback is disabled → hard error
          logError(LOG_MODULE, method, 'SMTP send failed and Resend fallback is disabled', {
            invoiceId: job.invoiceId,
            smtpError: sendResult.error,
          });
          throw new Error(`SMTP send failed and Resend fallback is disabled for this company. Error: ${sendResult.error}`);
        }

        // Either no SMTP configured OR fallback explicitly allowed → try Resend
        logInfo(LOG_MODULE, method, 'SMTP unavailable, falling back to Resend', {
          invoiceId: job.invoiceId,
          smtpError: sendResult.error,
        });

        sendResult = await resendService.sendEmail({
          to: job.recipientEmail,
          subject: generated.subject,
          bodyText: bodyTextWithFooter,
          bodyHtml: bodyHtmlWithTracking,
          companyId: job.companyId,
          replyTo,
        });

        if (!sendResult.success) {
          throw new Error(sendResult.error || 'Failed to send email (both SMTP and Resend failed)');
        }

        logInfo(LOG_MODULE, method, 'Email sent via Resend (fallback)', {
          invoiceId: job.invoiceId,
          recipientEmail: job.recipientEmail,
          messageId: sendResult.messageId,
        });
      } else {
        logInfo(LOG_MODULE, method, 'Email sent via SMTP (client domain)', {
          invoiceId: job.invoiceId,
          recipientEmail: job.recipientEmail,
          messageId: sendResult.messageId,
        });
      }

      // 6. Log to DB with pre-generated ID
      // NOTE: If email was sent but DB log fails (e.g. FK violation from deleted invoice),
      // we still return success to prevent BullMQ retries (which would re-send the email).
      try {
        await createEmailLog({
          id: emailLogId,
          invoiceId: job.invoiceId,
          companyId: job.companyId,
          emailType: job.emailType,
          recipientEmail: job.recipientEmail,
          subject: generated.subject,
          body: generated.bodyText,
          sendgridMessageId: sendResult.messageId,
        });

        // 7. Send notification to CLIENT (company) about what emails were sent to their customers
        try {
          await this.sendClientNotification({
            companyId: job.companyId,
            customerName: job.customerName,
            recipientEmail: job.recipientEmail,
            invoiceAmount: job.invoiceAmount,
            daysOverdue: job.daysOverdue,
            emailType: job.emailType,
            subject: generated.subject,
            messageId: sendResult.messageId || 'unknown',
          });
        } catch (notifError) {
          logError(LOG_MODULE, method, 'Failed to send client notification (non-blocking)', notifError);
          // Don't fail the whole operation for this
        }
      } catch (dbLogError) {
        logError(LOG_MODULE, method, 'Email sent but DB log failed (invoice may have been deleted)', dbLogError, {
          invoiceId: job.invoiceId,
          recipientEmail: job.recipientEmail,
          messageId: sendResult.messageId,
        });
        // Still return success — email was delivered, we just can't log it.
        // Returning failure here would cause BullMQ to retry and re-send the email.
        return { success: true, sendgridMessageId: sendResult.messageId, emailLogId };
      }

      return { success: true, sendgridMessageId: sendResult.messageId, emailLogId };
    } catch (error) {
      logError(LOG_MODULE, method, 'Failed to send email', error, {
        invoiceId: job.invoiceId,
        recipientEmail: job.recipientEmail,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send a pre-composed email (user edited in shadow mode).
   * Uses stored subject/body instead of regenerating via Claude.
   * For shadow mode approvals where user customized the email.
   */
  async sendDunningEmailDirect(job: {
    companyId: string;
    invoiceId: string;
    customerId: string;
    recipientEmail: string;
    customerName: string;
    invoiceAmount: number;
    dueDate: string;
    daysOverdue: number;
    emailType: string;
    attemptNumber: number;
    storedSubject: string;
    storedBody: string;
  }): Promise<SendResult> {
    const method = 'sendDunningEmailDirect';

    // DEV MODE: Don't send real emails in development
    if (config.nodeEnv === 'development') {
      logInfo(LOG_MODULE, method, 'DEV MODE: Email not sent (stored content preview)', {
        to: job.recipientEmail,
        subject: job.storedSubject,
        invoiceId: job.invoiceId,
      });
      return { success: true, sendgridMessageId: 'dev-mode-' + Date.now() };
    }

    logInfo(LOG_MODULE, method, 'Sending user-edited email', {
      invoiceId: job.invoiceId,
      emailType: job.emailType,
    });

    try {
      // 1. Fetch company for reply-to
      let replyTo: string | undefined;
      let smtpFallbackToResend = false;
      try {
        const company = await pool.query(
          'SELECT reply_to_email, smtp_fallback_to_resend FROM companies WHERE id = $1',
          [job.companyId]
        );
        if (company.rows[0]) {
          replyTo = company.rows[0].reply_to_email || undefined;
          smtpFallbackToResend = company.rows[0].smtp_fallback_to_resend || false;
        }
      } catch (err: any) {
        logInfo(LOG_MODULE, method, 'Failed to fetch company settings (non-critical)', { error: err?.message });
      }

      // 2. Pre-generate email log ID for tracking
      const emailLogId = crypto.randomUUID();
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      const frontendUrl = config.frontendUrl || 'http://localhost:5173';

      // 3. Add tracking pixel + unsubscribe footer
      const trackOpenUrl = `${backendUrl}/api/email/track/open?logId=${emailLogId}`;
      const unsubData = `${job.recipientEmail}:${job.companyId}`;
      const hmac = crypto.createHmac('sha256', config.jwtSecret || 'fallback-secret');
      hmac.update(unsubData);
      const unsubToken = hmac.digest('hex');
      const unsubUrl = `${frontendUrl}/unsubscribe?token=${unsubToken}&email=${encodeURIComponent(job.recipientEmail)}&company=${job.companyId}`;

      const bodyHtmlWithTracking = (job.storedBody || '') +
        `<img src="${trackOpenUrl}" width="1" height="1" style="display:none" alt="" />` +
        `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">` +
        `You receive these emails because you have an outstanding balance. ` +
        `<a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe</a> to stop payment reminders.</div>`;

      // 4. Send via SMTP or Resend
      let sendResult = await sendViaSmtp(
        job.companyId,
        job.recipientEmail,
        job.storedSubject,
        bodyHtmlWithTracking,
        replyTo
      );

      if (!sendResult.success) {
        const smtpIsConfigured = sendResult.error !== 'SMTP not configured';
        if (smtpIsConfigured && !smtpFallbackToResend) {
          logError(LOG_MODULE, method, 'SMTP failed and fallback disabled', {
            invoiceId: job.invoiceId,
          });
          throw new Error(`SMTP send failed: ${sendResult.error}`);
        }

        logInfo(LOG_MODULE, method, 'SMTP failed, trying Resend fallback');
        sendResult = await resendService.sendEmail({
          to: job.recipientEmail,
          subject: job.storedSubject,
          bodyText: job.storedBody,
          bodyHtml: bodyHtmlWithTracking,
          companyId: job.companyId,
          replyTo,
        });

        if (!sendResult.success) {
          throw new Error(sendResult.error || 'Failed to send via Resend');
        }
      }

      // 5. Log to database
      try {
        await createEmailLog({
          id: emailLogId,
          invoiceId: job.invoiceId,
          companyId: job.companyId,
          emailType: job.emailType as any,
          recipientEmail: job.recipientEmail,
          subject: job.storedSubject,
          body: job.storedBody,
          sendgridMessageId: sendResult.messageId,
        });
      } catch (dbErr) {
        logError(LOG_MODULE, method, 'Failed to log email (non-critical)', dbErr);
        // Still return success — email was sent
      }

      return { success: true, sendgridMessageId: sendResult.messageId, emailLogId };
    } catch (error) {
      logError(LOG_MODULE, method, 'Failed to send direct email', error, {
        invoiceId: job.invoiceId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Send notification to CLIENT (company account holder)
   * About emails sent to their customers
   */
  private async sendClientNotification(data: {
    companyId: string;
    customerName: string;
    recipientEmail: string;
    invoiceAmount: number;
    daysOverdue: number;
    emailType: string;
    subject: string;
    messageId: string;
  }): Promise<void> {
    const method = 'sendClientNotification';

    try {
      // Get company contact email
      const companyResult = await pool.query(
        'SELECT reply_to_email FROM companies WHERE id = $1',
        [data.companyId]
      );

      if (!companyResult.rows[0]?.company_email) {
        logInfo(LOG_MODULE, method, 'Company email not configured, skipping client notification');
        return;
      }

      const clientEmail = companyResult.rows[0].company_email;

      const emailBody = `
Email Sent to Your Customer
===========================

We just sent a dunning email to one of your customers:

Customer: ${data.customerName}
Customer Email: ${data.recipientEmail}
Invoice Amount: $${(data.invoiceAmount / 100).toFixed(2)}
Days Overdue: ${data.daysOverdue}
Email Type: ${data.emailType.replace(/_/g, ' ').toUpperCase()}

Email Subject: "${data.subject}"

---
Check the Admin Dashboard → Activity → Emails tab to:
✓ See full email content
✓ Preview what was sent
✓ Edit or resend emails
✓ Track open rates and responses

Message ID: ${data.messageId}
      `.trim();

      await resendService.sendEmail({
        to: clientEmail,
        subject: `[RecoverAI] Email sent to ${data.customerName}`,
        bodyText: emailBody,
        bodyHtml: emailBody.split('\n').join('<br>'),
        companyId: data.companyId,
      });

      logInfo(LOG_MODULE, method, 'Client notification sent', {
        customerEmail: data.recipientEmail,
        clientEmail,
      });
    } catch (error) {
      logError(LOG_MODULE, method, 'Failed to send client notification', error);
      // Non-blocking, so just log and continue
    }
  }
}

export default new EmailService();

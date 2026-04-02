import crypto from 'crypto';
import { config } from '../config/env';
import { DunningEmailJob } from '../types/email';
import { createEmailLog } from '../db/emailLogs';
import { findCompanyById } from '../db/companies';  // P0: Get reply-to email
import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import aiService from './aiService';
import resendService from './resendService';

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
      // 1. Generate personalized email via AI
      const generated = await aiService.generateDunningEmail({
        customerId: job.customerId,
        invoiceId: job.invoiceId,
        customerName: job.customerName,
        invoiceAmount: job.invoiceAmount,
        dueDate: job.dueDate,
        daysOverdue: job.daysOverdue,
        riskScore: job.riskScore,
        previousReminders: job.attemptNumber - 1,
        companyName: 'RecoverAI',
        paymentLink: job.paymentLink,
      }, job.companyId);

      // 2. Pre-generate email log ID so we can inject tracking pixel before sending
      const emailLogId = crypto.randomUUID();
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      // 3. Inject tracking pixel + unsubscribe footer (CAN-SPAM / GDPR compliance)
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

      // P0: Fetch company reply-to email (non-blocking)
      let replyTo: string | undefined;
      try {
        const company = await findCompanyById(job.companyId);
        replyTo = company?.reply_to_email || undefined;
      } catch { /* non-critical */ }

      // 4. Send via Resend
      const sendResult = await resendService.sendEmail({
        to: job.recipientEmail,
        subject: generated.subject,
        bodyText: bodyTextWithFooter,
        bodyHtml: bodyHtmlWithTracking,
        companyId: job.companyId,
        replyTo,  // P0: Wire reply-to through
      });

      if (!sendResult.success) {
        throw new Error(sendResult.error || 'Failed to send email');
      }

      logInfo(LOG_MODULE, method, 'Email sent via Resend', {
        invoiceId: job.invoiceId,
        recipientEmail: job.recipientEmail,
        messageId: sendResult.messageId,
        subject: generated.subject,
      });

      // 5. Log to DB with pre-generated ID
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

        // 6. Send notification to CLIENT (company) about what emails were sent to their customers
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
        'SELECT company_email FROM companies WHERE id = $1',
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

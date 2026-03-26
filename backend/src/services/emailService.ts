import crypto from 'crypto';
import { config } from '../config/env';
import { DunningEmailJob } from '../types/email';
import { createEmailLog } from '../db/emailLogs';
import { findCompanyById } from '../db/companies';  // P0: Get reply-to email
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
}

export default new EmailService();

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const emailLogs_1 = require("../db/emailLogs");
const logger_1 = require("../utils/logger");
const aiService_1 = __importDefault(require("./aiService"));
const resendService_1 = __importDefault(require("./resendService"));
const LOG_MODULE = 'emailService';
class EmailService {
    /**
     * Send a dunning email via SendGrid.
     * Uses AI to generate personalized subject + body.
     * Logs to email_logs table on success.
     */
    async sendDunningEmail(job) {
        const method = 'sendDunningEmail';
        (0, logger_1.logInfo)(LOG_MODULE, method, 'Generating email content', {
            invoiceId: job.invoiceId,
            emailType: job.emailType,
            daysOverdue: job.daysOverdue,
        });
        if (!env_1.config.resend.apiKey) {
            (0, logger_1.logError)(LOG_MODULE, method, 'RESEND_API_KEY not configured');
            return { success: false, error: 'Resend not configured' };
        }
        if (!env_1.config.resend.fromEmail) {
            (0, logger_1.logError)(LOG_MODULE, method, 'RESEND_FROM_EMAIL not configured');
            return { success: false, error: 'Sender email not configured' };
        }
        try {
            // 1. Generate personalized email via AI
            const generated = await aiService_1.default.generateDunningEmail({
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
            });
            // 2. Pre-generate email log ID so we can inject tracking pixel before sending
            const emailLogId = crypto_1.default.randomUUID();
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            // 3. Inject tracking pixel + unsubscribe footer (CAN-SPAM / GDPR compliance)
            const trackOpenUrl = `${backendUrl}/api/email/track/open?logId=${emailLogId}`;
            const unsubToken = Buffer.from(`${job.recipientEmail}:${job.companyId}`).toString('base64');
            const unsubUrl = `${frontendUrl}/unsubscribe?token=${unsubToken}`;
            const bodyHtmlWithTracking = (generated.bodyHtml || '') +
                `<img src="${trackOpenUrl}" width="1" height="1" style="display:none" alt="" />` +
                `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">` +
                `You receive these emails because you have an outstanding balance. ` +
                `<a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe</a> to stop payment reminders.</div>`;
            const bodyTextWithFooter = (generated.bodyText || '') +
                `\n\n---\nTo unsubscribe from future emails: ${unsubUrl}`;
            // 4. Send via Resend
            const sendResult = await resendService_1.default.sendEmail({
                to: job.recipientEmail,
                subject: generated.subject,
                bodyText: bodyTextWithFooter,
                bodyHtml: bodyHtmlWithTracking,
            });
            if (!sendResult.success) {
                throw new Error(sendResult.error || 'Failed to send email');
            }
            (0, logger_1.logInfo)(LOG_MODULE, method, 'Email sent via Resend', {
                invoiceId: job.invoiceId,
                recipientEmail: job.recipientEmail,
                messageId: sendResult.messageId,
                subject: generated.subject,
            });
            // 5. Log to DB with pre-generated ID
            // NOTE: If email was sent but DB log fails (e.g. FK violation from deleted invoice),
            // we still return success to prevent BullMQ retries (which would re-send the email).
            try {
                await (0, emailLogs_1.createEmailLog)({
                    id: emailLogId,
                    invoiceId: job.invoiceId,
                    companyId: job.companyId,
                    emailType: job.emailType,
                    recipientEmail: job.recipientEmail,
                    subject: generated.subject,
                    body: generated.bodyText,
                    sendgridMessageId: sendResult.messageId,
                });
            }
            catch (dbLogError) {
                (0, logger_1.logError)(LOG_MODULE, method, 'Email sent but DB log failed (invoice may have been deleted)', dbLogError, {
                    invoiceId: job.invoiceId,
                    recipientEmail: job.recipientEmail,
                    messageId: sendResult.messageId,
                });
                // Still return success — email was delivered, we just can't log it.
                // Returning failure here would cause BullMQ to retry and re-send the email.
                return { success: true, sendgridMessageId: sendResult.messageId, emailLogId };
            }
            return { success: true, sendgridMessageId: sendResult.messageId, emailLogId };
        }
        catch (error) {
            (0, logger_1.logError)(LOG_MODULE, method, 'Failed to send email', error, {
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
exports.default = new EmailService();

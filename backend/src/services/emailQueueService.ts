/**
 * Email Queue Service (P0: 4-State Queue System)
 * Handles queued email sending for AUTO mode + retry logic
 */

import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';
import emailService from './emailService';
import {
  getPendingForAutoSend,
  getFailedForRetry,
  markAsSent,
  markAsFailed,
} from '../db/pilotQueuedEmails';
import { createEmailLog } from '../db/emailLogs';

const LOG_MODULE = 'emailQueueService';

/**
 * Send queued emails for AUTO mode
 * Runs every 6 hours
 */
export async function sendQueuedEmails(): Promise<{ sent: number; failed: number }> {
  const LOG_HANDLER = 'sendQueuedEmails';

  try {
    const emails = await getPendingForAutoSend();

    let sent = 0;
    let failed = 0;

    // Skip logging if no work to do (silently return)
    if (emails.length === 0) {
      return { sent: 0, failed: 0 };
    }

    logInfo(LOG_MODULE, LOG_HANDLER, `Processing ${emails.length} pending emails for AUTO mode`);

    for (const email of emails) {
      try {
        // Send email via Resend
        const sendResult = await emailService.sendDunningEmail({
          companyId: email.company_id,
          invoiceId: email.invoice_id,
          customerId: email.customer_id,
          recipientEmail: email.recipient_email,
          customerName: email.customer_name,
          invoiceAmount: email.invoice_amount,
          dueDate: new Date(email.created_at).toISOString(), // Approximate due date
          daysOverdue: email.days_overdue,
          emailType: email.email_type as 'dunning_1' | 'dunning_2' | 'dunning_3' | 'dunning_4' | 'dunning_5' | 'payment_plan_offer',
          attemptNumber: 1,
        });

        if (sendResult.success) {
          // Create email log
          await createEmailLog({
            companyId: email.company_id,
            invoiceId: email.invoice_id,
            recipientEmail: email.recipient_email,
            subject: email.subject || '',
            body: email.body || '',
            emailType: email.email_type as any,
            sendgridMessageId: sendResult.sendgridMessageId,
          });

          // Mark as sent
          await markAsSent(email.id, email.company_id, sendResult.sendgridMessageId || '');

          sent++;
          logInfo(LOG_MODULE, LOG_HANDLER, `✅ Sent email`, {
            emailId: email.id,
            invoiceId: email.invoice_id,
          });
        } else {
          // Mark as failed with retry scheduled
          const retryAt = new Date();
          retryAt.setMinutes(retryAt.getMinutes() + 5);

          await markAsFailed(email.id, email.company_id, sendResult.error || 'Unknown error', 1);

          failed++;
          logError(LOG_MODULE, LOG_HANDLER, `❌ Failed to send email`, {
            emailId: email.id,
            error: sendResult.error,
          });
        }
      } catch (err) {
        failed++;
        logError(LOG_MODULE, LOG_HANDLER, `Exception sending email`, err, {
          emailId: email.id,
        });
      }
    }

    logInfo(LOG_MODULE, LOG_HANDLER, `Job complete`, {
      sent,
      failed,
      total: emails.length,
    });

    return { sent, failed };
  } catch (err) {
    logError(LOG_MODULE, LOG_HANDLER, 'Job error', err);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Retry failed emails
 * Runs every 5 minutes
 */
export async function retryFailedEmails(): Promise<{ retried: number }> {
  const LOG_HANDLER = 'retryFailedEmails';

  try {
    const emails = await getFailedForRetry();

    let retried = 0;

    // Skip logging if no work to do (silently return)
    if (emails.length === 0) {
      return { retried: 0 };
    }

    logInfo(LOG_MODULE, LOG_HANDLER, `Processing ${emails.length} failed emails for retry`);

    for (const email of emails) {
      try {
        // Retry send
        const sendResult = await emailService.sendDunningEmail({
          companyId: email.company_id,
          invoiceId: email.invoice_id,
          customerId: email.customer_id,
          recipientEmail: email.recipient_email,
          customerName: email.customer_name,
          invoiceAmount: email.invoice_amount,
          dueDate: new Date(email.created_at).toISOString(),
          daysOverdue: email.days_overdue,
          emailType: email.email_type as 'dunning_1' | 'dunning_2' | 'dunning_3' | 'dunning_4' | 'dunning_5' | 'payment_plan_offer',
          attemptNumber: (email.failure_count || 0) + 1,
        });

        if (sendResult.success) {
          // Create email log
          await createEmailLog({
            companyId: email.company_id,
            invoiceId: email.invoice_id,
            recipientEmail: email.recipient_email,
            subject: email.subject || '',
            body: email.body || '',
            emailType: email.email_type as any,
            sendgridMessageId: sendResult.sendgridMessageId,
          });

          // Mark as sent
          await markAsSent(email.id, email.company_id, sendResult.sendgridMessageId || '');

          retried++;
          logInfo(LOG_MODULE, LOG_HANDLER, `✅ Retry successful`, {
            emailId: email.id,
            attempt: (email.failure_count || 0) + 1,
          });
        } else {
          // Increment failure count and schedule next retry (exponential backoff)
          const nextFailureCount = (email.failure_count || 0) + 1;
          const backoffMinutes = 5 * nextFailureCount; // 5, 10, 15

          await markAsFailed(email.id, email.company_id, sendResult.error || 'Unknown error', nextFailureCount);

          logWarn(LOG_MODULE, LOG_HANDLER, `Retry failed, scheduling next attempt`, {
            emailId: email.id,
            attempt: nextFailureCount,
            backoffMinutes,
          });
        }
      } catch (err) {
        logError(LOG_MODULE, LOG_HANDLER, `Exception retrying email`, err, {
          emailId: email.id,
        });
      }
    }

    logInfo(LOG_MODULE, LOG_HANDLER, `Job complete`, {
      retried,
      total: emails.length,
    });

    return { retried };
  } catch (err) {
    logError(LOG_MODULE, LOG_HANDLER, 'Job error', err);
    return { retried: 0 };
  }
}

// Import logWarn for the retry logic
import { logWarn } from '../utils/logger';

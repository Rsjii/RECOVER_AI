/**
 * Event Listeners: React to application events
 *
 * Pattern: Netflix, Uber, Stripe
 * Decouples controllers from business logic (event-driven architecture)
 *
 * Example: Admin approves audit → emits event → listener sends email
 * Benefit: Admin gets instant response, email sent in background
 */

import {
  appEvents,
  AppEvent,
  AuditApprovedPayload,
  PaymentReceivedPayload,
  InvoicePaidPayload,
  CallCompletedPayload,
} from '../events/eventEmitter';
import { updateInvoiceStatus } from '../db/invoices';
import { findInvoiceById } from '../db/invoices';
import { logInfo, logError } from '../utils/logger';
import resendService from '../services/resendService';

const LOG_MODULE = 'eventListeners';

/**
 * Register all event listeners on server startup
 */
export function registerEventListeners() {
  logInfo(LOG_MODULE, 'registerEventListeners', 'Registering event listeners');

  // ============================================================
  // EVENT: AUDIT_APPROVED → Send invite email
  // ============================================================
  appEvents.on(AppEvent.AUDIT_APPROVED, async (payload: AuditApprovedPayload) => {
    try {
      const link = `${process.env.FRONTEND_URL || 'https://recoverai.com'}/audit?invite=${payload.token}`;

      const subject = '🎯 Your CashOS AR Analysis Link';
      const bodyText = `
Hi ${payload.companyName || 'there'},

Thanks for requesting an AR analysis. Click below to see how much working capital you can free up in 90 days.

${link}

This link expires in 7 days.

Best,
CashOS Team
      `.trim();

      const bodyHtml = `
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">
  <h2>🎯 Your CashOS AR Analysis</h2>
  <p>Hi ${payload.companyName || 'there'},</p>
  <p>We've approved your request! Click below to get your custom AR analysis.</p>
  <p>
    <a href="${link}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
      Start Analysis
    </a>
  </p>
  <p style="font-size: 12px; color: #999;">CashOS</p>
</body>
</html>
      `;

      await resendService.sendEmail({
        to: payload.email,
        subject,
        bodyText,
        bodyHtml,
      });

      logInfo(LOG_MODULE, 'auditApproved', 'Email sent', { email: payload.email });
    } catch (err) {
      logError(LOG_MODULE, 'auditApproved', 'Failed to send email', err);
    }
  });

  // ============================================================
  // EVENT: PAYMENT_RECEIVED → Mark invoice as paid
  // ============================================================
  appEvents.on(AppEvent.PAYMENT_RECEIVED, async (payload: PaymentReceivedPayload) => {
    try {
      const invoice = await findInvoiceById(payload.invoiceId, payload.companyId);
      if (!invoice) {
        logError(LOG_MODULE, 'paymentReceived', 'Invoice not found', new Error(payload.invoiceId));
        return;
      }

      await updateInvoiceStatus(payload.invoiceId, payload.companyId, 'paid');

      logInfo(LOG_MODULE, 'paymentReceived', 'Invoice marked as paid', {
        invoiceId: payload.invoiceId,
        amount: payload.amount,
      });

      // Emit downstream event
      appEvents.emit(AppEvent.INVOICE_PAID, {
        invoiceId: payload.invoiceId,
        companyId: payload.companyId,
        amount: payload.amount,
      });
    } catch (err) {
      logError(LOG_MODULE, 'paymentReceived', 'Failed to update invoice', err);
    }
  });

  // ============================================================
  // EVENT: INVOICE_PAID → Log the event
  // ============================================================
  appEvents.on(AppEvent.INVOICE_PAID, async (payload: InvoicePaidPayload) => {
    try {
      logInfo(LOG_MODULE, 'invoicePaid', 'Invoice marked as paid', {
        invoiceId: payload.invoiceId,
        amount: payload.amount,
      });
    } catch (err) {
      logError(LOG_MODULE, 'invoicePaid', 'Error handling invoice paid event', err);
    }
  });

  // ============================================================
  // EVENT: CALL_COMPLETED → Log the event
  // ============================================================
  appEvents.on(AppEvent.CALL_COMPLETED, async (payload: CallCompletedPayload) => {
    try {
      logInfo(LOG_MODULE, 'callCompleted', 'Call completed', {
        invoiceId: payload.invoiceId,
        outcome: payload.outcome,
        duration: payload.durationSeconds,
      });
    } catch (err) {
      logError(LOG_MODULE, 'callCompleted', 'Error handling call completed event', err);
    }
  });

  logInfo(LOG_MODULE, 'registerEventListeners', '✅ Event listeners registered', {
    count: 5,
  });
}

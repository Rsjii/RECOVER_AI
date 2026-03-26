/**
 * Application Event Bus (Event-Driven Architecture)
 *
 * Pattern: Netflix, Uber, Stripe
 * Benefits:
 * - Decoupled architecture (approving audit doesn't block on email sending)
 * - Instant triggers (no 6-hour delay)
 * - Scalable (add listeners without changing controllers)
 *
 * Reference: https://en.wikipedia.org/wiki/Event-driven_architecture
 */

import { EventEmitter } from 'events';

/**
 * All application events
 */
export enum AppEvent {
  // Audit/Account Events
  AUDIT_APPROVED = 'audit.approved',
  AUDIT_REJECTED = 'audit.rejected',

  // Payment Events
  PAYMENT_RECEIVED = 'payment.received',

  // Invoice Events
  INVOICE_PAID = 'invoice.paid',

  // Email Events
  EMAIL_SENT = 'email.sent',
  EMAIL_FAILED = 'email.failed',

  // Call Events
  CALL_COMPLETED = 'call.completed',
}

/**
 * Event payload types
 */
export interface AuditApprovedPayload {
  email: string;
  token: string;
  companyName?: string;
}

export interface PaymentReceivedPayload {
  invoiceId: string;
  companyId: string;
  amount: number;
  stripeChargeId?: string;
}

export interface InvoicePaidPayload {
  invoiceId: string;
  companyId: string;
  amount: number;
}

export interface CallCompletedPayload {
  invoiceId: string;
  companyId: string;
  customerId: string;
  durationSeconds: number;
  outcome: 'completed' | 'no_answer' | 'failed';
}

/**
 * Global event emitter (in-process)
 * Handles all application events synchronously
 */
export const appEvents = new EventEmitter();

/**
 * Emit event with type safety
 */
export function emitEvent<T>(event: AppEvent, payload: T): void {
  appEvents.emit(event, payload);
}

/**
 * Usage:
 *
 * // In controllers:
 * emitEvent(AppEvent.AUDIT_APPROVED, { email, token });
 *
 * // In event listeners:
 * appEvents.on(AppEvent.AUDIT_APPROVED, async (payload: AuditApprovedPayload) => {
 *   await queueAuditApprovalEmail(payload.email);
 * });
 */

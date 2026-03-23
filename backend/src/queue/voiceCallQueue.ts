/**
 * Voice Call Queue — STUB (Phase 5 implementation)
 *
 * This file exists as an integration hook for Phase 3 (Tier 4 customers).
 * Phase 5 will add the full Twilio outbound calling implementation.
 *
 * When a Tier 4 customer is identified in agentLoop.ts, queueVoiceCall() is called here.
 * Currently it just logs the intent so the backlog is visible.
 */
import { logInfo } from '../utils/logger';

export interface VoiceCallJob {
  invoiceId: string;
  companyId: string;
  customerId: string;
  customerPhone: string;
  customerName: string;
  invoiceAmount: number;
  daysOverdue: number;
}

/**
 * Queue an outbound voice call for a Tier 4 customer.
 * Phase 5 will replace this stub with a real Twilio BullMQ worker.
 */
export async function queueVoiceCall(job: VoiceCallJob): Promise<void> {
  logInfo('voiceCallQueue', 'queueVoiceCall', '[STUB] Voice call queued — Phase 5 implementation pending', {
    invoiceId: job.invoiceId,
    customerId: job.customerId,
    customerPhone: job.customerPhone,
    invoiceAmount: job.invoiceAmount,
    daysOverdue: job.daysOverdue,
  });
  // TODO (Phase 5): Initialize Twilio client, add BullMQ job, wire up TwiML webhook
}

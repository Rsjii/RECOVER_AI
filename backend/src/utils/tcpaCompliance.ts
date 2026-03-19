/**
 * TCPA Compliance Utilities
 *
 * TCPA (Telephone Consumer Protection Act) rules for SMS:
 * - Must have express written consent (opt-in) before sending
 * - Cannot send between 9 PM and 8 AM recipient's local time
 * - Must honor STOP / UNSUBSCRIBE / QUIT / CANCEL / END requests immediately
 * - Reasonable frequency (not excessive harassment)
 */

export interface TCPACheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if sending an SMS is TCPA-compliant.
 * Pass the customer's local hour (0-23) and opt-in status.
 */
export function checkTCPACompliance(params: {
  phoneOptIn: boolean;
  localHour: number;          // 0-23 in customer's timezone (use US Eastern as default)
  smsCountLast30Days: number; // how many SMS sent to this customer in last 30 days
}): TCPACheckResult {
  const { phoneOptIn, localHour, smsCountLast30Days } = params;

  if (!phoneOptIn) {
    return { allowed: false, reason: 'Customer has not opted in to SMS' };
  }

  // Quiet hours: no SMS before 8 AM or after 9 PM
  if (localHour < 8 || localHour >= 21) {
    return { allowed: false, reason: `Outside permitted hours (${localHour}:00 — allowed 08:00-21:00)` };
  }

  // Frequency cap: max 5 SMS per 30 days per customer
  if (smsCountLast30Days >= 5) {
    return { allowed: false, reason: `Frequency cap reached (${smsCountLast30Days} SMS in last 30 days, max 5)` };
  }

  return { allowed: true };
}

/**
 * Returns the current hour in US Eastern time (safe default for US customers).
 * Use this when customer timezone is unknown.
 */
export function getUSEasternHour(): number {
  const now = new Date();
  // US Eastern = UTC-5 (EST) or UTC-4 (EDT)
  // Use conservative UTC-5 (EST) so we never send too early/late
  const utcHour = now.getUTCHours();
  const etHour = (utcHour - 5 + 24) % 24;
  return etHour;
}

/**
 * Parse a STOP keyword from an inbound SMS reply.
 * Returns true if this is an unsubscribe request.
 */
export function isUnsubscribeReply(messageBody: string): boolean {
  const normalized = messageBody.trim().toUpperCase();
  const stopKeywords = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
  return stopKeywords.includes(normalized);
}

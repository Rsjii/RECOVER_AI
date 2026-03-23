import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';

const MODULE = 'declineCodeService';

export type DeclineType = 'soft' | 'hard' | 'fraud';

export interface DeclineClassification {
  type: DeclineType;
  confidence: number;  // 0-100
  description: string;
}

export interface DeclineCodeStat {
  decline_code: string;
  total_occurrences: number;
  successful_retries: number;
  success_rate: number;
  updated_at: string;
}

// ============================================================
// Stripe decline code → type mapping
// Reference: https://stripe.com/docs/declines/codes
// ============================================================

const FRAUD_CODES = new Set([
  'fraudulent',
  'suspected_fraud',
  'card_reported_lost',
  'pickup_card',
  'refer_to_issuer',
]);

const HARD_CODES = new Set([
  'do_not_try_again',
  'lost_card',
  'stolen_card',
  'card_not_supported',
  'generic_decline',
  'no_such_card',
  'invalid_account',
  'account_closed',
  'not_permitted',
  'security_violation',
  'service_not_allowed',
  'stop_payment_order',
  'transaction_not_allowed',
  'restricted_card',
  'revocation_of_all_authorizations',
  'revocation_of_authorization',
  'invalid_amount',
  'currency_not_supported',
  'testmode_decline',
]);

const SOFT_CODES = new Set([
  'insufficient_funds',
  'card_velocity_exceeded',
  'do_not_honor',
  'processing_error',
  'try_again_later',
  'withdrawal_count_limit_exceeded',
  'new_account_information_available',
  'reenter_transaction',
  'no_action_taken',
  'duplicate_transaction',
  'bank_error',
  'incorrect_cvc',
  'incorrect_zip',
  'incorrect_pin',
  'expired_card',
  'call_issuer',
  'online_or_offline_pin_required',
]);

/**
 * Classify a Stripe decline code as soft / hard / fraud.
 * Unknown codes default to soft (conservative — don't stop dunning on unknown codes).
 */
export function classifyDeclineCode(
  declineCode: string | null | undefined,
  failureCode?: string | null
): DeclineClassification {
  const code = (declineCode || failureCode || '').toLowerCase().trim();

  if (!code) {
    return { type: 'soft', confidence: 50, description: 'No decline code — defaulting to soft' };
  }

  if (FRAUD_CODES.has(code)) {
    return { type: 'fraud', confidence: 100, description: `Fraud signal: ${code}` };
  }

  if (HARD_CODES.has(code)) {
    return { type: 'hard', confidence: 100, description: `Hard decline: ${code}` };
  }

  if (SOFT_CODES.has(code)) {
    return { type: 'soft', confidence: 100, description: `Soft decline, retry eligible: ${code}` };
  }

  // Unknown code — treat as soft (conservative default)
  return { type: 'soft', confidence: 70, description: `Unknown code ${code} — defaulting to soft` };
}

/**
 * Record a decline occurrence in decline_code_stats.
 * Non-blocking — never throws.
 */
export async function recordDeclineOccurrence(
  companyId: string,
  declineCode: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO decline_code_stats (company_id, decline_code, total_occurrences, successful_retries, success_rate, updated_at)
       VALUES ($1, $2, 1, 0, 0, NOW())
       ON CONFLICT (company_id, decline_code) DO UPDATE
         SET total_occurrences = decline_code_stats.total_occurrences + 1,
             updated_at = NOW()`,
      [companyId, declineCode]
    );
  } catch (err) {
    logError(MODULE, 'recordDeclineOccurrence', 'Failed (non-blocking)', err);
  }
}

/**
 * Record a successful retry for a given decline code.
 * Updates success_rate automatically. Non-blocking — never throws.
 */
export async function recordSuccessfulRetry(
  companyId: string,
  declineCode: string
): Promise<void> {
  try {
    await pool.query(
      `UPDATE decline_code_stats
       SET successful_retries = successful_retries + 1,
           success_rate = ROUND(
             ((successful_retries + 1)::DECIMAL / NULLIF(total_occurrences, 0)) * 100,
             2
           ),
           updated_at = NOW()
       WHERE company_id = $1 AND decline_code = $2`,
      [companyId, declineCode]
    );
  } catch (err) {
    logError(MODULE, 'recordSuccessfulRetry', 'Failed (non-blocking)', err);
  }
}

/**
 * Get decline code analytics for a company (sorted by occurrence count desc).
 */
export async function getDeclineCodeAnalytics(companyId: string): Promise<DeclineCodeStat[]> {
  try {
    const result = await pool.query(
      `SELECT decline_code, total_occurrences, successful_retries, success_rate::float, updated_at
       FROM decline_code_stats
       WHERE company_id = $1
       ORDER BY total_occurrences DESC`,
      [companyId]
    );
    logInfo(MODULE, 'getDeclineCodeAnalytics', 'Fetched', { companyId, count: result.rows.length });
    return result.rows;
  } catch (err) {
    logError(MODULE, 'getDeclineCodeAnalytics', 'Failed', err);
    return [];
  }
}

/**
 * Get decline analysis for a specific invoice.
 */
export async function getInvoiceDeclineAnalysis(
  invoiceId: string,
  companyId: string
): Promise<{ decline_code: string | null; classification: DeclineClassification | null } | null> {
  try {
    const result = await pool.query(
      `SELECT decline_code, last_decline_type, decline_confidence
       FROM invoices
       WHERE id = $1 AND company_id = $2`,
      [invoiceId, companyId]
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    if (!row.decline_code) return { decline_code: null, classification: null };

    const classification = classifyDeclineCode(row.decline_code);
    return { decline_code: row.decline_code, classification };
  } catch (err) {
    logError(MODULE, 'getInvoiceDeclineAnalysis', 'Failed', err);
    return null;
  }
}

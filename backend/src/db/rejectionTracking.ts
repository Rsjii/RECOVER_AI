/**
 * P0: Rejection Tracking (7-day re-queue safeguard)
 * Prevents Agent Loop from re-queueing rejected emails within 7 days
 */

import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';

export interface RejectionTrack {
  id: string;
  company_id: string;
  invoice_id: string;
  email_type: string;
  rejected_by: string;
  rejected_at: string;
  expires_at: string;
  reason?: string;
}

// ============================================================
// INSERT: Track rejection for 7 days
// ============================================================
export async function insertRejectionTracking(params: {
  companyId: string;
  invoiceId: string;
  emailType: string;
  rejectedBy: string; // user_id or 'system_mode_switch'
  reason?: string;
  expiresDays?: number; // default 7
}): Promise<boolean> {
  try {
    const expireDays = params.expiresDays || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expireDays);

    await pool.query(
      `INSERT INTO rejection_tracking
         (company_id, invoice_id, email_type, rejected_by, reason, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (invoice_id, email_type) DO UPDATE SET
         rejected_at = NOW(),
         expires_at = $6`,
      [
        params.companyId,
        params.invoiceId,
        params.emailType,
        params.rejectedBy,
        params.reason || null,
        expiresAt,
      ]
    );

    logInfo('rejectionTracking', 'insert', `Rejection tracked: ${params.emailType}`, {
      invoiceId: params.invoiceId,
      expiresAt: expiresAt.toISOString(),
    });
    return true;
  } catch (error) {
    logError('rejectionTracking', 'insert', 'Error inserting rejection tracking', error);
    throw error;
  }
}

// ============================================================
// GET: Check if recently rejected
// ============================================================
export async function isRecentlyRejected(
  invoiceId: string,
  emailType: string
): Promise<RejectionTrack | null> {
  try {
    const result = await pool.query(
      `SELECT * FROM rejection_tracking
       WHERE invoice_id = $1
         AND email_type = $2
         AND expires_at > NOW()
       LIMIT 1`,
      [invoiceId, emailType]
    );

    return result.rows[0] as RejectionTrack || null;
  } catch (error) {
    logError('rejectionTracking', 'isRecent', 'Error checking rejection', error);
    throw error;
  }
}

// ============================================================
// GET: All active rejections for company
// ============================================================
export async function getActiveRejections(companyId: string): Promise<RejectionTrack[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM rejection_tracking
       WHERE company_id = $1 AND expires_at > NOW()
       ORDER BY expires_at DESC`,
      [companyId]
    );

    return result.rows as RejectionTrack[];
  } catch (error) {
    logError('rejectionTracking', 'getActive', 'Error fetching active rejections', error);
    throw error;
  }
}

// ============================================================
// DELETE: Clean up expired rejections
// ============================================================
export async function cleanupExpiredRejections(): Promise<number> {
  try {
    const result = await pool.query(
      `DELETE FROM rejection_tracking WHERE expires_at <= NOW()`
    );

    const count = result.rowCount || 0;
    if (count > 0) {
      logInfo('rejectionTracking', 'cleanup', `Cleaned up ${count} expired rejections`);
    }
    return count;
  } catch (error) {
    logError('rejectionTracking', 'cleanup', 'Error cleaning up rejections', error);
    throw error;
  }
}

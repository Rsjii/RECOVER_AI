import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';

const MODULE = 'auditRequests';

/**
 * Create a new audit request (from website form submission)
 */
export async function createAuditRequest(params: {
  token: string;
  companyName: string;
  email: string;
}): Promise<{ id: string }> {
  try {
    const result = await pool.query(
      `INSERT INTO audit_requests (token, company_name, email)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [params.token, params.companyName, params.email]
    );

    logInfo(MODULE, 'createAuditRequest', `Created audit request for ${params.email}`, {
      company: params.companyName,
    });

    return { id: result.rows[0].id };
  } catch (err: any) {
    logError(MODULE, 'createAuditRequest', 'Failed to create audit request', err);
    throw err;
  }
}

/**
 * Get audit request by email
 */
export async function getAuditRequest(email: string): Promise<{
  id: string;
  token: string;
  company_name: string;
  email: string;
  status: string;
  created_at: string;
} | null> {
  try {
    const result = await pool.query(
      `SELECT id, token, company_name, email, status, created_at FROM audit_requests
       WHERE email = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    return result.rows[0] || null;
  } catch (err: any) {
    logError(MODULE, 'getAuditRequest', 'Failed to get audit request', err);
    throw err;
  }
}

/**
 * List audit requests with optional filtering
 */
export async function listAuditRequests(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  try {
    let query = `SELECT id, token, company_name, email, revenue, phone, status, created_at, reviewed_at
                 FROM audit_requests`;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters?.status) {
      query += ` WHERE status = $${paramIndex++}`;
      params.push(filters.status);
    }

    query += ` ORDER BY created_at DESC`;

    if (filters?.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }

    if (filters?.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }

    const result = await pool.query(query, params);
    return result.rows;
  } catch (err: any) {
    logError(MODULE, 'listAuditRequests', 'Failed to list audit requests', err);
    throw err;
  }
}

/**
 * Update audit request status (pending → approved → converted)
 */
export async function updateAuditRequestStatus(
  email: string,
  status: 'pending' | 'approved' | 'rejected' | 'converted'
): Promise<void> {
  try {
    await pool.query(
      `UPDATE audit_requests SET status = $1, reviewed_at = NOW() WHERE email = $2`,
      [status, email]
    );

    logInfo(MODULE, 'updateAuditRequestStatus', `Updated ${email} status to ${status}`);
  } catch (err: any) {
    logError(MODULE, 'updateAuditRequestStatus', 'Failed to update request status', err);
    throw err;
  }
}

/**
 * Mark audit request as converted (after they become pilot)
 */
export async function markAuditRequestAsConverted(email: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE audit_requests
       SET status = 'converted', converted_at = NOW()
       WHERE email = $1`,
      [email]
    );

    logInfo(MODULE, 'markAuditRequestAsConverted', `Marked ${email} as converted`);
  } catch (err: any) {
    logError(MODULE, 'markAuditRequestAsConverted', 'Failed to mark as converted', err);
    throw err;
  }
}

/**
 * Get conversion stats for dashboard
 */
export async function getAuditRequestStats(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  converted: number;
  total: number;
}> {
  try {
    const result = await pool.query(
      `SELECT
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted,
        COUNT(*) as total
       FROM audit_requests`
    );

    const row = result.rows[0];
    return {
      pending: parseInt(row.pending) || 0,
      approved: parseInt(row.approved) || 0,
      rejected: parseInt(row.rejected) || 0,
      converted: parseInt(row.converted) || 0,
      total: parseInt(row.total) || 0,
    };
  } catch (err: any) {
    logError(MODULE, 'getAuditRequestStats', 'Failed to get stats', err);
    throw err;
  }
}

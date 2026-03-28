import { pool } from '../config/database';

/**
 * Get audit request by ID
 */
export const getAuditRequest = async (id: string) => {
  try {
    const result = await pool.query(
      `SELECT * FROM audit_requests WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('getAuditRequest error:', err);
    return null;
  }
};

/**
 * Get audit request by token
 */
export const getAuditRequestByToken = async (token: string) => {
  try {
    const result = await pool.query(
      `SELECT * FROM audit_requests WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('getAuditRequestByToken error:', err);
    return null;
  }
};

/**
 * Update audit request with analysis data
 */
export const updateAuditRequest = async (id: string, data: any) => {
  try {
    const fields: string[] = [];
    const values: any[] = [id];
    let paramCount = 2;

    // Build dynamic UPDATE query
    if (data.status) {
      fields.push(`status = $${paramCount}`);
      values.push(data.status);
      paramCount++;
    }
    if (data.analysis_data) {
      fields.push(`analysis_data = $${paramCount}`);
      values.push(JSON.stringify(data.analysis_data));
      paramCount++;
    }
    if (data.analysis_started_at !== undefined) {
      fields.push(`analysis_started_at = $${paramCount}`);
      values.push(data.analysis_started_at);
      paramCount++;
    }
    if (data.analysis_completed_at !== undefined) {
      fields.push(`analysis_completed_at = $${paramCount}`);
      values.push(data.analysis_completed_at);
      paramCount++;
    }

    if (fields.length === 0) return null;

    const query = `
      UPDATE audit_requests
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (err) {
    console.error('updateAuditRequest error:', err);
    throw err;
  }
};

/**
 * Update audit request status by ID
 */
export const updateAuditRequestStatusById = async (id: string, status: string) => {
  try {
    const result = await pool.query(
      `UPDATE audit_requests SET status = $1 WHERE id = $2 RETURNING id`,
      [status, id]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('updateAuditRequestStatusById error:', err);
    return null;
  }
};

/**
 * List all audit requests
 */
export const listAuditRequests = async () => {
  try {
    const result = await pool.query(
      `SELECT * FROM audit_requests ORDER BY created_at DESC`
    );
    return result.rows || [];
  } catch (err) {
    console.error('listAuditRequests error:', err);
    return [];
  }
};

/**
 * Get audit request stats
 */
export const getAuditRequestStats = async () => {
  try {
    const result = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'analysis_complete') as analysis_complete,
        COUNT(*) FILTER (WHERE status = 'converted') as converted
      FROM audit_requests`
    );
    return result.rows[0] || { pending: 0, approved: 0, analysis_complete: 0, converted: 0 };
  } catch (err) {
    console.error('getAuditRequestStats error:', err);
    return { pending: 0, approved: 0, analysis_complete: 0, converted: 0 };
  }
};

/**
 * Find in-progress audit for email
 */
export const findInProgressAudit = async (email: string) => {
  try {
    const result = await pool.query(
      `SELECT * FROM audit_requests
       WHERE email = $1 AND status != 'converted' AND status != 'cancelled'
       AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('findInProgressAudit error:', err);
    return null;
  }
};

/**
 * Create audit request (used in new flow)
 */
export const createAuditRequest = async (data: {
  token: string;
  email: string;
  company_name: string;
  expires_at: Date;
}) => {
  try {
    const result = await pool.query(
      `INSERT INTO audit_requests (token, email, company_name, expires_at, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [data.token, data.email, data.company_name, data.expires_at]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('createAuditRequest error:', err);
    throw err;
  }
};

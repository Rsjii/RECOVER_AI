import { pool } from '../config/database';

export interface ErrorLogEntry {
  id: string;
  company_id: string;
  module: string;
  handler: string;
  message: string;
  error_name?: string;
  error_message?: string;
  stack_trace?: string;
  user_id?: string;
  url?: string;
  timestamp: Date;
}

export interface ErrorLogRow {
  id: string;
  company_id: string;
  module: string;
  handler: string;
  message: string;
  error_name: string;
  error_message: string;
  stack_trace: string;
  user_id: string;
  url: string;
  timestamp: string;
}

/**
 * Insert an error log entry
 */
export async function insertErrorLog(
  companyId: string,
  module: string,
  handler: string,
  message: string,
  error?: any,
  userId?: string,
  url?: string
): Promise<void> {
  try {
    const errorName = error?.name || 'Error';
    const errorMessage = error?.message || '';
    const stackTrace = error?.stack || '';

    await pool.query(
      `INSERT INTO error_logs (company_id, module, handler, message, error_name, error_message, stack_trace, user_id, url, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [companyId, module, handler, message, errorName, errorMessage, stackTrace, userId || null, url || null]
    );
  } catch (err) {
    // Fail silently - error logging should never break the app
    console.error('[ErrorLogs] Failed to insert error log:', err);
  }
}

/**
 * Get error logs for a company with pagination
 */
export async function getErrorLogs(
  companyId: string,
  limit: number = 50,
  offset: number = 0,
  filter?: {
    module?: string;
    handler?: string;
    search?: string;
    hoursAgo?: number;
  }
): Promise<{ logs: ErrorLogRow[]; total: number }> {
  let whereClause = 'WHERE company_id = $1';
  const params: any[] = [companyId];
  let paramIndex = 2;

  if (filter?.module) {
    whereClause += ` AND module = $${paramIndex}`;
    params.push(filter.module);
    paramIndex++;
  }

  if (filter?.handler) {
    whereClause += ` AND handler = $${paramIndex}`;
    params.push(filter.handler);
    paramIndex++;
  }

  if (filter?.search) {
    whereClause += ` AND (message ILIKE $${paramIndex} OR error_message ILIKE $${paramIndex})`;
    params.push(`%${filter.search}%`);
    paramIndex++;
  }

  if (filter?.hoursAgo) {
    whereClause += ` AND timestamp > NOW() - INTERVAL '${filter.hoursAgo} hours'`;
  }

  // Get total count
  const countResult = await pool.query(
    `SELECT COUNT(*) as count FROM error_logs ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get logs
  const logsResult = await pool.query(
    `SELECT id, company_id, module, handler, message, error_name, error_message, stack_trace, user_id, url,
            TO_CHAR(timestamp, 'YYYY-MM-DD HH24:MI:SS') as timestamp
     FROM error_logs
     ${whereClause}
     ORDER BY timestamp DESC
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    logs: logsResult.rows,
    total
  };
}

/**
 * Get error statistics for a company
 */
export async function getErrorStats(companyId: string, hoursAgo: number = 24): Promise<any> {
  const result = await pool.query(
    `SELECT
       COUNT(*) as total_errors,
       COUNT(DISTINCT module) as unique_modules,
       COUNT(DISTINCT error_name) as unique_error_types,
       MIN(timestamp) as first_error,
       MAX(timestamp) as last_error
     FROM error_logs
     WHERE company_id = $1 AND timestamp > NOW() - INTERVAL '${hoursAgo} hours'`,
    [companyId]
  );

  return result.rows[0] || {
    total_errors: 0,
    unique_modules: 0,
    unique_error_types: 0,
    first_error: null,
    last_error: null
  };
}

/**
 * Get error trends by module
 */
export async function getErrorTrendsByModule(companyId: string, hoursAgo: number = 24): Promise<any[]> {
  const result = await pool.query(
    `SELECT
       module,
       COUNT(*) as error_count,
       COUNT(DISTINCT error_name) as unique_errors,
       MAX(timestamp) as last_error
     FROM error_logs
     WHERE company_id = $1 AND timestamp > NOW() - INTERVAL '${hoursAgo} hours'
     GROUP BY module
     ORDER BY error_count DESC`,
    [companyId]
  );

  return result.rows;
}

/**
 * Delete old error logs (retention policy)
 */
export async function deleteOldErrorLogs(companyId: string, retentionDays: number = 30): Promise<number> {
  const result = await pool.query(
    `DELETE FROM error_logs
     WHERE company_id = $1 AND timestamp < NOW() - INTERVAL '${retentionDays} days'`,
    [companyId]
  );

  return result.rowCount || 0;
}
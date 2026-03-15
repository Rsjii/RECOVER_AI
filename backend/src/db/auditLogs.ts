import { pool } from '../config/database';
import { logError, logWarn } from '../utils/logger';

export interface CreateAuditLogInput {
  companyId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Write an audit log entry. Wrapped in try-catch so audit failures
 * never crash the calling request handler.
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<void> {
  try {
    const {
      companyId,
      userId,
      action,
      resourceType,
      resourceId,
      details,
      changes,
      ipAddress,
      userAgent,
    } = input;

    if (!companyId || !action || !resourceType) {
      logWarn('auditLogs', 'createAuditLog', 'Skipping audit log — missing required fields', {
        companyId,
        action,
        resourceType,
      });
      return;
    }

    await pool.query(
      `INSERT INTO audit_logs (company_id, user_id, action, resource_type, resource_id, details, changes, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        companyId,
        userId || null,
        action,
        resourceType,
        resourceId || null,
        details ? JSON.stringify(details) : null,
        changes ? JSON.stringify(changes) : null,
        ipAddress || null,
        userAgent || null,
      ]
    );
  } catch (error) {
    // Log but NEVER throw — audit failures must not crash request handlers
    logError('auditLogs', 'createAuditLog', 'Failed to write audit log', error, {
      action: input.action,
      resourceType: input.resourceType,
    });
  }
}

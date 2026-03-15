"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuditLog = createAuditLog;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
/**
 * Write an audit log entry. Wrapped in try-catch so audit failures
 * never crash the calling request handler.
 */
async function createAuditLog(input) {
    try {
        const { companyId, userId, action, resourceType, resourceId, details, changes, ipAddress, userAgent, } = input;
        if (!companyId || !action || !resourceType) {
            (0, logger_1.logWarn)('auditLogs', 'createAuditLog', 'Skipping audit log — missing required fields', {
                companyId,
                action,
                resourceType,
            });
            return;
        }
        await database_1.pool.query(`INSERT INTO audit_logs (company_id, user_id, action, resource_type, resource_id, details, changes, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
            companyId,
            userId || null,
            action,
            resourceType,
            resourceId || null,
            details ? JSON.stringify(details) : null,
            changes ? JSON.stringify(changes) : null,
            ipAddress || null,
            userAgent || null,
        ]);
    }
    catch (error) {
        // Log but NEVER throw — audit failures must not crash request handlers
        (0, logger_1.logError)('auditLogs', 'createAuditLog', 'Failed to write audit log', error, {
            action: input.action,
            resourceType: input.resourceType,
        });
    }
}

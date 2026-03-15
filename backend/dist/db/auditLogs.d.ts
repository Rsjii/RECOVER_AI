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
export declare function createAuditLog(input: CreateAuditLogInput): Promise<void>;

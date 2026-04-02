import { Request, Response, NextFunction } from 'express';
import { createEventLog } from '../db/eventLogs';
import { logInfo } from '../utils/logger';

const LOG_MODULE = 'auditLogger';

/**
 * Audit logging middleware
 * Logs user actions to event_logs table after successful responses
 */
export function auditLogger(req: Request, res: Response, next: NextFunction): void {
  // Capture the original send method
  const originalSend = res.send;
  const originalJson = res.json;

  // Extract user info from token/session
  const userId = (req as any).userId || '';
  const userEmail = ((req as any).email || '').toLowerCase();
  const companyId = (req as any).companyId || '';

  // Extract IP and User-Agent
  const ipAddress = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '');
  const userAgent = req.get('user-agent') || '';

  // Override res.send to capture response status
  (res as any).send = function(data: any) {
    // Only log on successful operations (POST, PUT, DELETE)
    const isAuditableMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const isSuccessful = res.statusCode >= 200 && res.statusCode < 300;

    if (isAuditableMethod && isSuccessful && userId && companyId) {
      // Determine action type from route and method
      const action = determineAction(req.method, req.path);
      const { resourceType, resourceId } = extractResourceInfo(req);

      // Log asynchronously without blocking response
      Promise.resolve().then(() => {
        return createEventLog({
          companyId,
          userId,
          userEmail,
          action,
          resourceType,
          resourceId,
          details: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            timestamp: new Date().toISOString(),
          },
          ipAddress,
          userAgent,
        });
      }).catch((err) => {
        logInfo(LOG_MODULE, 'auditLogger', 'Failed to log event (non-blocking)', {
          action,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    // Call original send
    return originalSend.call(this, data);
  };

  // Override res.json similarly
  (res as any).json = function(data: any) {
    // Only log on successful operations
    const isAuditableMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const isSuccessful = res.statusCode >= 200 && res.statusCode < 300;

    if (isAuditableMethod && isSuccessful && userId && companyId) {
      const action = determineAction(req.method, req.path);
      const { resourceType, resourceId } = extractResourceInfo(req);

      // Log asynchronously
      Promise.resolve().then(() => {
        return createEventLog({
          companyId,
          userId,
          userEmail,
          action,
          resourceType,
          resourceId,
          details: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            timestamp: new Date().toISOString(),
          },
          ipAddress,
          userAgent,
        });
      }).catch((err) => {
        logInfo(LOG_MODULE, 'auditLogger', 'Failed to log event (non-blocking)', {
          action,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

    // Call original json
    return originalJson.call(this, data);
  };

  next();
}

/**
 * Determine action type from HTTP method and path
 * Maps endpoints to meaningful event names
 */
function determineAction(method: string, path: string): string {
  const pathLower = path.toLowerCase();

  // Auth events
  if (pathLower.includes('/login')) return 'LOGIN';
  if (pathLower.includes('/signup')) return 'SIGNUP';
  if (pathLower.includes('/logout')) return 'LOGOUT';
  if (pathLower.includes('/reset-password')) return 'RESET_PASSWORD';
  if (pathLower.includes('/change-password')) return 'CHANGE_PASSWORD';
  if (pathLower.includes('/forgot-password')) return 'FORGOT_PASSWORD';
  if (pathLower.includes('/refresh')) return 'REFRESH_TOKEN';

  // Invoice events
  if (pathLower.includes('/invoices')) {
    if (pathLower.includes('/manual')) return 'CREATE_INVOICE_MANUAL';
    if (pathLower.includes('/csv')) return 'IMPORT_INVOICES_CSV';
    if (pathLower.includes('/batch-delete')) return 'BATCH_DELETE_INVOICES';
    if (pathLower.includes('/dunning/pause')) return 'PAUSE_INVOICE_DUNNING';
    if (pathLower.includes('/dunning/resume')) return 'RESUME_INVOICE_DUNNING';
    if (pathLower.includes('/dunning')) return 'STOP_INVOICE_DUNNING';
    if (pathLower.includes('/status')) return 'UPDATE_INVOICE_STATUS';
    if (method === 'DELETE') return 'DELETE_INVOICE';
    if (method === 'POST') return 'CREATE_INVOICE';
    if (method === 'PUT') return 'UPDATE_INVOICE';
  }

  // Customer events
  if (pathLower.includes('/customers')) {
    if (pathLower.includes('/bulk-delete')) return 'BULK_DELETE_CUSTOMERS';
    if (pathLower.includes('/import-csv')) return 'IMPORT_CUSTOMERS_CSV';
    if (pathLower.includes('/unsubscribe')) return 'CUSTOMER_UNSUBSCRIBE';
    if (method === 'DELETE') return 'DELETE_CUSTOMER';
    if (method === 'POST') return 'CREATE_CUSTOMER';
    if (method === 'PUT' || method === 'PATCH') return 'UPDATE_CUSTOMER';
  }

  // Settings/Configuration events
  if (pathLower.includes('/settings')) {
    if (pathLower.includes('/dunning')) return 'UPDATE_DUNNING_SETTINGS';
    if (pathLower.includes('/slack')) return 'UPDATE_SLACK_SETTINGS';
    if (pathLower.includes('/general')) return 'UPDATE_GENERAL_SETTINGS';
    if (pathLower.includes('/pilot-mode')) return 'UPDATE_PILOT_MODE';
    if (pathLower.includes('/manual-mode')) return 'UPDATE_MANUAL_MODE';
    return 'UPDATE_SETTINGS';
  }

  // Email events
  if (pathLower.includes('/email')) {
    if (pathLower.includes('/send-now')) return 'SEND_EMAIL_NOW';
    if (pathLower.includes('/schedule')) return 'SCHEDULE_EMAIL';
    if (pathLower.includes('/webhook')) return 'EMAIL_WEBHOOK_RECEIVED';
    if (method === 'DELETE') return 'DELETE_EMAIL';
    if (method === 'PUT' || method === 'PATCH') return 'UPDATE_EMAIL';
  }

  // Team/User events
  if (pathLower.includes('/team') || pathLower.includes('/users')) {
    if (method === 'DELETE') return 'DELETE_USER';
    if (method === 'PUT' || method === 'PATCH') return 'UPDATE_USER';
    if (method === 'POST') return 'INVITE_USER';
  }

  // Payment plan events
  if (pathLower.includes('/payment-plan')) {
    if (pathLower.includes('/accept')) return 'ACCEPT_PAYMENT_PLAN';
    if (pathLower.includes('/approve')) return 'APPROVE_PAYMENT_PLAN';
    if (method === 'DELETE') return 'DELETE_PAYMENT_PLAN';
    if (method === 'POST') return 'CREATE_PAYMENT_PLAN';
    if (method === 'PUT' || method === 'PATCH') return 'UPDATE_PAYMENT_PLAN';
  }

  // Billing events
  if (pathLower.includes('/billing')) {
    if (pathLower.includes('/webhook')) return 'BILLING_WEBHOOK_RECEIVED';
    if (method === 'POST') return 'INITIATE_BILLING';
  }

  // Default actions based on HTTP method
  if (method === 'DELETE') return 'DELETE';
  if (method === 'PUT' || method === 'PATCH') return 'UPDATE';
  if (method === 'POST') return 'CREATE';

  return 'ACTION';
}

/**
 * Extract resource type and ID from request
 */
function extractResourceInfo(req: Request): { resourceType: string; resourceId: string } {
  const pathLower = req.path.toLowerCase();
  let resourceType = 'unknown';
  let resourceId = 'unknown';

  // Specific resource type detection
  if (pathLower.includes('/invoices')) resourceType = 'invoice';
  else if (pathLower.includes('/customers')) resourceType = 'customer';
  else if (pathLower.includes('/email')) resourceType = 'email';
  else if (pathLower.includes('/settings')) resourceType = 'settings';
  else if (pathLower.includes('/team') || pathLower.includes('/users')) resourceType = 'user';
  else if (pathLower.includes('/payment-plan')) resourceType = 'payment_plan';
  else if (pathLower.includes('/billing')) resourceType = 'billing';
  else if (pathLower.includes('/compliance')) resourceType = 'compliance';
  else if (pathLower.includes('/audit')) resourceType = 'audit';
  else if (pathLower.includes('/integrations')) resourceType = 'integration';
  else if (pathLower.includes('/slack')) resourceType = 'slack_integration';
  else if (pathLower.includes('/stripe')) resourceType = 'stripe_integration';
  else {
    // Fallback: extract from path
    const pathSegments = req.path.split('/');
    resourceType = pathSegments[pathSegments.length - 2] || 'unknown';
    resourceType = resourceType.replace(/s$/, '').replace(/-/g, '_');
  }

  // Extract ID from params or path
  if (req.params.id) {
    resourceId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  } else if (req.params.invoiceId) {
    resourceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : (req.params.invoiceId as string);
  } else if (req.params.customerId) {
    resourceId = Array.isArray(req.params.customerId) ? req.params.customerId[0] : (req.params.customerId as string);
  } else if (req.params.emailId) {
    resourceId = Array.isArray(req.params.emailId) ? req.params.emailId[0] : (req.params.emailId as string);
  } else if (req.params.userId) {
    resourceId = Array.isArray(req.params.userId) ? req.params.userId[0] : (req.params.userId as string);
  } else {
    // Try to extract from path
    const pathSegments = req.path.split('/').filter(s => s && !s.match(/^(api|v\d|admin)$/i));
    resourceId = pathSegments[pathSegments.length - 1] || 'unknown';
    // Filter out common non-ID segments
    if (resourceId.match(/^(manual|csv|status|dunning|pause|resume|slack|general|pilot-mode|manual-mode|send-now|schedule|bulk-delete|batch-delete|import|refresh|logout|reset|bootstrap|onboard)$/i)) {
      resourceId = 'new';
    }
  }

  return { resourceType, resourceId };
}

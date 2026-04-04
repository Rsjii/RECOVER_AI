import { Response } from 'express';

/**
 * Standard error response handler
 * Returns error in consistent format: { error: message, statusCode: number }
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  message: string,
  details?: Record<string, any>
): Response {
  const errorResponse: any = { error: message };
  if (details) {
    errorResponse.details = details;
  }
  return res.status(statusCode).json(errorResponse);
}

/**
 * Parse error and determine appropriate status code and message
 * IMPORTANT: Sanitize error messages to avoid leaking internal details
 */
export function parseError(err: any): { statusCode: number; message: string } {
  // Handle specific error types with custom status codes
  if (err.statusCode) {
    // Only return raw message if it's explicitly marked as safe, otherwise sanitize
    const message = err.isSafe ? err.message : sanitizeErrorMessage(err.message, err.statusCode);
    return { statusCode: err.statusCode, message };
  }

  // Handle Stripe errors (they have type property)
  if (err.type === 'StripeSignatureVerificationError') {
    return { statusCode: 400, message: 'Invalid webhook signature' };
  }

  if (err.message) {
    // Safe, user-facing error messages (whitelist approach)
    // Only return message if it matches known safe patterns
    const msg = err.message.toLowerCase();

    if (msg.includes('not found')) return { statusCode: 404, message: 'Resource not found' };
    if (msg.includes('not connected')) return { statusCode: 400, message: 'Integration not connected' };
    if (msg.includes('invalid email or password')) return { statusCode: 401, message: 'Invalid email or password' };
    if (msg.includes('unauthorized')) return { statusCode: 401, message: 'Unauthorized' };
    if (msg.includes('forbidden')) return { statusCode: 403, message: 'Access denied' };
    if (msg.includes('already exists') || msg.includes('already registered')) return { statusCode: 409, message: 'Resource already exists' };
    if (msg.includes('required')) return { statusCode: 400, message: 'Missing required field' };

    // Default: Don't leak internal error details in production
    return { statusCode: 500, message: 'An error occurred. Please try again later.' };
  }

  return { statusCode: 500, message: 'An error occurred. Please try again later.' };
}

/**
 * Sanitize error message for client exposure
 * Removes internal details (database, crypto, file paths, etc.)
 */
function sanitizeErrorMessage(message: string, statusCode: number): string {
  // Return generic message for 5xx errors (internal)
  if (statusCode >= 500) {
    return 'An error occurred. Please try again later.';
  }

  // For 4xx errors, return the message only if it looks user-safe
  // Avoid messages with SQL, file paths, stack traces, crypto details
  const unsafePatterns = [
    /syntax error/i,
    /column/i,
    /table/i,
    /database/i,
    /query/i,
    /\/[a-z]/i, // file paths
    /stack/i,
    /at \w+/i, // stack traces
  ];

  if (unsafePatterns.some(p => p.test(message))) {
    return 'Invalid request';
  }

  return message;
}

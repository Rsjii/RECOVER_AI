/**
 * Structured logger utility for frontend
 * - Development: logs to console with formatted output
 * - Production: sends errors to backend API (/api/logs/errors) for admin dashboard
 */

const isDev = import.meta.env.DEV;

interface LogContext {
  module: string;
  handler: string;
  message: string;
  data?: any;
  error?: any;
}

function formatLog(_level: string, { module, handler, message }: LogContext): string {
  return `[${module}:${handler}] ${message}`;
}

/**
 * Send error to backend for production error tracking
 * Non-blocking - logs errors silently if sending fails
 */
async function sendErrorToBackend(module: string, handler: string, message: string, error?: any): Promise<void> {
  try {
    // Only send in production and not too frequently (basic rate limiting)
    if (isDev) return;

    const payload = {
      module,
      handler,
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    // Fire and forget - use fetch with no await to not block
    fetch('/api/logs/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently fail - logging should never break the app
    });
  } catch (_err) {
    // Ignore errors during logging
  }
}

export function logInfo(module: string, handler: string, message: string, data?: any): void {
  if (!isDev) return;
  const log = formatLog('INFO', { module, handler, message, data });
  console.log(log, data || '');
}

export function logError(module: string, handler: string, message: string, error?: any): void {
  const log = formatLog('ERROR', { module, handler, message, error });

  if (isDev) {
    console.error(log, error || '');
  } else {
    // Send to backend for production error tracking
    sendErrorToBackend(module, handler, message, error);
  }
}

export function logWarn(module: string, handler: string, message: string, data?: any): void {
  if (!isDev) return;
  const log = formatLog('WARN', { module, handler, message, data });
  console.warn(log, data || '');
}
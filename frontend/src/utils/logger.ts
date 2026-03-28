/**
 * Simple logger utility for frontend
 * Logs to console in development, can be extended for production error tracking
 */

export function logInfo(module: string, handler: string, message: string, data?: any): void {
  console.log(`[${module}:${handler}] ${message}`, data || '');
}

export function logError(module: string, handler: string, message: string, error?: any): void {
  console.error(`[${module}:${handler}] ${message}`, error || '');
}

export function logWarn(module: string, handler: string, message: string, data?: any): void {
  console.warn(`[${module}:${handler}] ${message}`, data || '');
}

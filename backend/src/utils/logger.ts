import { AsyncLocalStorage } from 'async_hooks';
import { Request } from 'express';

type Level = 'INFO' | 'WARN' | 'ERROR';

export interface LogMeta {
  [key: string]: unknown;
}

interface RequestContext extends LogMeta {
  method?: string;
  path?: string;
  requestId?: string;
  traceparent?: string;
  userId?: string;
  companyId?: string;
}

const asyncLocalContext = new AsyncLocalStorage<RequestContext>();

const REDACT_KEYS = ['password', 'token', 'secret', 'authorization', 'cookie', 'api_key', 'apikey'];

function shouldRedact(key: string): boolean {
  const k = key.toLowerCase();
  return REDACT_KEYS.some((sensitiveKey) => k.includes(sensitiveKey));
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = shouldRedact(key) ? '[REDACTED]' : sanitizeValue(nestedValue);
    }
    return sanitized;
  }

  return value;
}

function safeSerialize(meta?: LogMeta): string {
  if (!meta) return '{}';
  try {
    return JSON.stringify(sanitizeValue(meta));
  } catch {
    return JSON.stringify({ serializationError: true });
  }
}

function emit(level: Level, module: string, handler: string, message: string, meta?: LogMeta): void {
  const context = asyncLocalContext.getStore() || {};
  const ts = new Date().toISOString();
  const payload = safeSerialize({ ...context, ...meta });
  const line = `${ts} [${module}] [${handler}] ${level}: ${message}`;

  if (level === 'ERROR') {
    console.error(line, payload);
    return;
  }

  if (level === 'WARN') {
    console.warn(line, payload);
    return;
  }

  console.log(line, payload);
}

export function logInfo(module: string, handler: string, message: string, meta?: LogMeta): void {
  emit('INFO', module, handler, message, meta);
}

export function logWarn(module: string, handler: string, message: string, meta?: LogMeta): void {
  emit('WARN', module, handler, message, meta);
}

export function logError(module: string, handler: string, message: string, error?: unknown, meta?: LogMeta): void {
  const err = error instanceof Error
    ? { errorMessage: error.message, errorStack: error.stack }
    : { errorMessage: String(error || '') };

  emit('ERROR', module, handler, message, { ...meta, ...err });
}

export function getRequestContext(req: Request): RequestContext {
  const maybeReq = req as any;
  return {
    method: req.method,
    path: req.path,
    requestId: maybeReq.requestId || req.header('x-request-id') || undefined,
    traceparent: req.header('traceparent') || undefined,
    userId: maybeReq.userId,
    companyId: maybeReq.companyId,
  };
}

export function withRequestContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalContext.run(context, fn);
}

export function getCurrentRequestContext(): RequestContext {
  return asyncLocalContext.getStore() || {};
}


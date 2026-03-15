"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logInfo = logInfo;
exports.logWarn = logWarn;
exports.logError = logError;
exports.getRequestContext = getRequestContext;
exports.withRequestContext = withRequestContext;
exports.getCurrentRequestContext = getCurrentRequestContext;
const async_hooks_1 = require("async_hooks");
const asyncLocalContext = new async_hooks_1.AsyncLocalStorage();
const REDACT_KEYS = ['password', 'token', 'secret', 'authorization', 'cookie', 'api_key', 'apikey'];
function shouldRedact(key) {
    const k = key.toLowerCase();
    return REDACT_KEYS.some((sensitiveKey) => k.includes(sensitiveKey));
}
function sanitizeValue(value) {
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value && typeof value === 'object') {
        const sanitized = {};
        for (const [key, nestedValue] of Object.entries(value)) {
            sanitized[key] = shouldRedact(key) ? '[REDACTED]' : sanitizeValue(nestedValue);
        }
        return sanitized;
    }
    return value;
}
function safeSerialize(meta) {
    if (!meta)
        return '{}';
    try {
        return JSON.stringify(sanitizeValue(meta));
    }
    catch {
        return JSON.stringify({ serializationError: true });
    }
}
function emit(level, module, handler, message, meta) {
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
function logInfo(module, handler, message, meta) {
    emit('INFO', module, handler, message, meta);
}
function logWarn(module, handler, message, meta) {
    emit('WARN', module, handler, message, meta);
}
function logError(module, handler, message, error, meta) {
    const err = error instanceof Error
        ? { errorMessage: error.message, errorStack: error.stack }
        : { errorMessage: String(error || '') };
    emit('ERROR', module, handler, message, { ...meta, ...err });
}
function getRequestContext(req) {
    const maybeReq = req;
    return {
        method: req.method,
        path: req.path,
        requestId: maybeReq.requestId || req.header('x-request-id') || undefined,
        traceparent: req.header('traceparent') || undefined,
        userId: maybeReq.userId,
        companyId: maybeReq.companyId,
    };
}
function withRequestContext(context, fn) {
    return asyncLocalContext.run(context, fn);
}
function getCurrentRequestContext() {
    return asyncLocalContext.getStore() || {};
}

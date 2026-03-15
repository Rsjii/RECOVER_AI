"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetry = withRetry;
const logger_1 = require("../utils/logger");
async function withRetry(fn, options = {}) {
    const { maxRetries = 3, delayMs = 1000, label = 'operation' } = options;
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < maxRetries) {
                const delay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
                (0, logger_1.logWarn)('retry', label, `Attempt ${attempt} failed, retrying in ${delay}ms`, {
                    error: lastError.message,
                    attempt,
                    maxRetries,
                });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

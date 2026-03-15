"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initObservability = initObservability;
const logger_1 = require("../utils/logger");
async function initObservability() {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        (0, logger_1.logInfo)('observability', 'initObservability', 'Sentry DSN not configured, skipping');
        return;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Sentry = require('@sentry/node');
        Sentry.init({
            dsn,
            environment: process.env.NODE_ENV || 'development',
            tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
            profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.0),
        });
        (0, logger_1.logInfo)('observability', 'initObservability', 'Sentry initialized');
    }
    catch (error) {
        (0, logger_1.logWarn)('observability', 'initObservability', 'Failed to initialize Sentry', {
            message: error instanceof Error ? error.message : String(error),
        });
    }
}

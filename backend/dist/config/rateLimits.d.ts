/**
 * Rate Limiting Configuration
 *
 * Different limits for development vs production
 * DEV: Generous limits for testing and development
 * PROD: Strict limits for security and reliability
 */
export declare const RATE_LIMITS: {
    api: {
        windowMs: number;
        dev: number;
        prod: number;
        description: string;
    };
    auth: {
        windowMs: number;
        dev: number;
        prod: number;
        description: string;
    };
    authSlowDown: {
        windowMs: number;
        delayAfter: {
            dev: number;
            prod: number;
        };
        delayMs: {
            dev: number;
            prod: number;
        };
        maxDelayMs: {
            dev: number;
            prod: number;
        };
        description: string;
    };
    stripe: {
        windowMs: number;
        dev: number;
        prod: number;
        description: string;
    };
    ai: {
        windowMs: number;
        dev: number;
        prod: number;
        description: string;
    };
    demo: {
        windowMs: number;
        dev: number;
        prod: number;
        description: string;
    };
    email: {
        windowMs: number;
        dev: number;
        prod: number;
        description: string;
    };
    webhook: {
        windowMs: number;
        dev: number;
        prod: number;
        description: string;
    };
};
/**
 * Get the appropriate rate limit for the current environment
 */
export declare function getRateLimit(endpoint: keyof typeof RATE_LIMITS): any;
/**
 * Check if we're in development mode
 */
export declare function isDevEnvironment(): boolean;

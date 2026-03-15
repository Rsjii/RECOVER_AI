import { Request } from 'express';
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
export declare function logInfo(module: string, handler: string, message: string, meta?: LogMeta): void;
export declare function logWarn(module: string, handler: string, message: string, meta?: LogMeta): void;
export declare function logError(module: string, handler: string, message: string, error?: unknown, meta?: LogMeta): void;
export declare function getRequestContext(req: Request): RequestContext;
export declare function withRequestContext<T>(context: RequestContext, fn: () => T): T;
export declare function getCurrentRequestContext(): RequestContext;
export {};

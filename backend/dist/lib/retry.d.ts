export declare function withRetry<T>(fn: () => Promise<T>, options?: {
    maxRetries?: number;
    delayMs?: number;
    label?: string;
}): Promise<T>;

import { logWarn } from '../utils/logger';

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; delayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, label = 'operation' } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
        logWarn('retry', label, `Attempt ${attempt} failed, retrying in ${delay}ms`, {
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


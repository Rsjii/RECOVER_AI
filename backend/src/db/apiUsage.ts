import { pool } from '../config/database';

export type ApiService = 'claude' | 'openai' | 'resend' | 'twilio';

export interface ApiUsageSummaryRow {
  service: string;
  model: string;
  period: string;
  usage_count: number;
  cost_usd: string;
  input_tokens: number;
  output_tokens: number;
}

export interface UpsertApiUsageInput {
  companyId: string;
  service: ApiService;
  model?: string;
  usageCount: number;
  costUsd: number;
  inputTokens?: number;
  outputTokens?: number;
  period: Date;
}

/**
 * Upsert API usage record for a company+service+month.
 * Uses ON CONFLICT to increment counters atomically.
 * Never throws — caller wraps in .catch() to keep non-blocking.
 */
export async function upsertApiUsage(input: UpsertApiUsageInput): Promise<void> {
  const { companyId, service, model = 'unknown', usageCount, costUsd, inputTokens = 0, outputTokens = 0, period } = input;
  // Normalize period to first of month
  const periodDate = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1));

  await pool.query(
    `INSERT INTO api_usage_tracking
       (company_id, service, model, usage_count, cost_usd, input_tokens, output_tokens, period)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (company_id, service, model, period)
     DO UPDATE SET
       usage_count   = api_usage_tracking.usage_count   + EXCLUDED.usage_count,
       cost_usd      = api_usage_tracking.cost_usd      + EXCLUDED.cost_usd,
       input_tokens  = api_usage_tracking.input_tokens  + EXCLUDED.input_tokens,
       output_tokens = api_usage_tracking.output_tokens + EXCLUDED.output_tokens`,
    [companyId, service, model, usageCount, costUsd, inputTokens, outputTokens, periodDate]
  );
}

/**
 * Get monthly usage breakdown for a company over a date range.
 */
export async function getApiUsageSummary(
  companyId: string,
  fromPeriod: Date,
  toPeriod: Date
): Promise<ApiUsageSummaryRow[]> {
  const result = await pool.query(
    `SELECT service, model, period, usage_count, cost_usd, input_tokens, output_tokens
     FROM api_usage_tracking
     WHERE company_id = $1
       AND period >= $2
       AND period <= $3
     ORDER BY period DESC, service, model`,
    [companyId, fromPeriod, toPeriod]
  );
  return result.rows;
}

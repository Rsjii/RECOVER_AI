import { pool } from '../config/database';

export async function getCompanyUsage(companyId: string, months = 12) {
  const result = await pool.query(`
    SELECT
      service,
      model,
      DATE_TRUNC('month', created_at)::date as month,
      COUNT(*)::int as calls,
      SUM(input_tokens)::bigint as input_tokens,
      SUM(output_tokens)::bigint as output_tokens,
      (SUM(CASE WHEN service = 'claude' THEN (input_tokens * 0.003 + output_tokens * 0.015) / 1000000
                WHEN service = 'openai' THEN (input_tokens * 0.005 + output_tokens * 0.015) / 1000000
                WHEN service = 'resend' THEN 0.0002
                ELSE 0 END))::numeric as cost_usd
    FROM api_usage_tracking
    WHERE company_id = $1 AND created_at > NOW() - INTERVAL '${months} months'
    GROUP BY service, model, DATE_TRUNC('month', created_at)
    ORDER BY DATE_TRUNC('month', created_at) DESC, cost_usd DESC
  `, [companyId]);

  return result.rows;
}

export async function getCompanyUsageSummary(companyId: string) {
  const result = await pool.query(`
    SELECT
      SUM(input_tokens)::bigint as total_input_tokens,
      SUM(output_tokens)::bigint as total_output_tokens,
      COUNT(*)::int as total_calls,
      (SUM(CASE WHEN service = 'claude' THEN (input_tokens * 0.003 + output_tokens * 0.015) / 1000000
                WHEN service = 'openai' THEN (input_tokens * 0.005 + output_tokens * 0.015) / 1000000
                WHEN service = 'resend' THEN 0.0002
                ELSE 0 END))::numeric as total_cost_usd,
      COUNT(DISTINCT DATE(created_at))::int as days_active
    FROM api_usage_tracking
    WHERE company_id = $1
  `, [companyId]);

  return result.rows[0] || {
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_calls: 0,
    total_cost_usd: 0,
    days_active: 0,
  };
}

export async function getCompanyUsageByModel(companyId: string) {
  const result = await pool.query(`
    SELECT
      model,
      COUNT(*)::int as calls,
      SUM(input_tokens)::bigint as input_tokens,
      SUM(output_tokens)::bigint as output_tokens,
      (SUM(CASE WHEN service = 'claude' THEN (input_tokens * 0.003 + output_tokens * 0.015) / 1000000
                WHEN service = 'openai' THEN (input_tokens * 0.005 + output_tokens * 0.015) / 1000000
                ELSE 0 END))::numeric as cost_usd
    FROM api_usage_tracking
    WHERE company_id = $1
    GROUP BY model
    ORDER BY calls DESC
  `, [companyId]);

  return result.rows;
}

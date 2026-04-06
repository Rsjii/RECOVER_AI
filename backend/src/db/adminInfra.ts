import { pool } from '../config/database';

export interface InfraStats {
  db_pool: { active: number; idle: number; waiting: number };
  api_metrics: { avg_latency_ms: number; p95_latency_ms: number; error_rate: number; requests_per_min: number };
  queue_stats: { pending: number; failed: number; processed_today: number };
  error_rate_24h: number;
}

export async function getInfrastructureStats(): Promise<InfraStats> {
  // Get DB pool stats (mock - real stats would come from pg_stat_statements or monitoring)
  const dbPoolStats = {
    active: Math.floor(Math.random() * 20 + 5),
    idle: Math.floor(Math.random() * 30 + 10),
    waiting: 0,
  };

  // Get API metrics from logs
  const apiMetricsResult = await pool.query(`
    SELECT
      AVG(EXTRACT(EPOCH FROM (response_time)))::int as avg_latency_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (response_time)))::int as p95_latency_ms,
      COUNT(CASE WHEN status_code >= 400 THEN 1 END)::float / COUNT(*)::float * 100 as error_rate,
      COUNT(*)::int as request_count,
      EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) as time_window_seconds
    FROM request_logs
    WHERE created_at > NOW() - INTERVAL '1 hour'
  `);

  const apiMetrics = apiMetricsResult.rows[0] || {};
  const time_window_seconds = apiMetrics.time_window_seconds || 3600;
  const requests_per_min = time_window_seconds > 0 ? Math.round((apiMetrics.request_count || 0) / (time_window_seconds / 60)) : 0;

  // Get queue stats (mock - real stats from Bull queue)
  const queueStats = {
    pending: Math.floor(Math.random() * 100 + 50),
    failed: Math.floor(Math.random() * 10),
    processed_today: Math.floor(Math.random() * 5000 + 2000),
  };

  // Get error rate 24h
  const errorRateResult = await pool.query(`
    SELECT
      COUNT(CASE WHEN status_code >= 400 THEN 1 END)::float / NULLIF(COUNT(*), 0)::float * 100 as error_rate
    FROM request_logs
    WHERE created_at > NOW() - INTERVAL '24 hours'
  `);

  const error_rate_24h = errorRateResult.rows[0]?.error_rate || 0;

  return {
    db_pool: dbPoolStats,
    api_metrics: {
      avg_latency_ms: apiMetrics.avg_latency_ms || 0,
      p95_latency_ms: apiMetrics.p95_latency_ms || 0,
      error_rate: parseFloat(apiMetrics.error_rate) || 0,
      requests_per_min,
    },
    queue_stats: queueStats,
    error_rate_24h,
  };
}

export async function getEndpointPerformance(limit = 20) {
  const result = await pool.query(`
    SELECT
      endpoint,
      method,
      COUNT(*)::int as requests,
      AVG(EXTRACT(EPOCH FROM (response_time)))::int as avg_latency_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (response_time)))::int as p95_latency_ms,
      COUNT(CASE WHEN status_code >= 500 THEN 1 END)::int as error_count,
      COUNT(CASE WHEN status_code >= 500 THEN 1 END)::float / COUNT(*)::float * 100 as error_rate
    FROM request_logs
    WHERE created_at > NOW() - INTERVAL '24 hours'
    GROUP BY endpoint, method
    ORDER BY avg_latency_ms DESC
    LIMIT $1
  `, [limit]);

  return result.rows;
}

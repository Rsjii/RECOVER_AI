import { pool } from '../config/database';

export interface IntegrationStatusRow {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncTime: string | null;
  errorMessage: string | null;
  config: Record<string, any>;
}

/**
 * Get integration status for all companies (admin view)
 */
export async function getIntegrationStatus(): Promise<IntegrationStatusRow[]> {
  const result = await pool.query(`
    SELECT
      provider,
      status,
      last_sync_at,
      error_message,
      config
    FROM integrations
    WHERE status IS NOT NULL
    ORDER BY provider ASC, last_sync_at DESC NULLS LAST
  `);

  return result.rows.map(row => ({
    name: row.provider,
    status: row.status || 'disconnected',
    lastSyncTime: row.last_sync_at ? new Date(row.last_sync_at).toISOString() : null,
    errorMessage: row.error_message,
    config: row.config || {},
  }));
}

/**
 * Get integration status for a specific company
 */
export async function getCompanyIntegrations(companyId: string): Promise<IntegrationStatusRow[]> {
  const result = await pool.query(
    `SELECT
      provider,
      status,
      last_sync_at,
      error_message,
      config
    FROM integrations
    WHERE company_id = $1 AND status IS NOT NULL
    ORDER BY provider ASC, last_sync_at DESC NULLS LAST`,
    [companyId]
  );

  return result.rows.map(row => ({
    name: row.provider,
    status: row.status || 'disconnected',
    lastSyncTime: row.last_sync_at ? new Date(row.last_sync_at).toISOString() : null,
    errorMessage: row.error_message,
    config: row.config || {},
  }));
}

/**
 * Get webhook delivery stats
 */
export async function getWebhookDeliveryStats(): Promise<{
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  avgDeliveryTime: number;
  recentFailures: Array<{ provider: string; error: string; timestamp: string }>;
}> {
  const result = await pool.query(`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'delivered')::int as successful,
      COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
      AVG(EXTRACT(EPOCH FROM (completed_at - created_at)))::numeric as avg_time
    FROM webhook_deliveries
    WHERE created_at > NOW() - INTERVAL '30 days'
  `);

  const stats = result.rows[0] || {};

  const failuresResult = await pool.query(`
    SELECT
      provider,
      error_message,
      created_at
    FROM webhook_deliveries
    WHERE status = 'failed' AND created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 10
  `);

  return {
    totalDeliveries: stats.total || 0,
    successfulDeliveries: stats.successful || 0,
    failedDeliveries: stats.failed || 0,
    avgDeliveryTime: parseFloat(stats.avg_time) || 0,
    recentFailures: (failuresResult.rows || []).map(row => ({
      provider: row.provider,
      error: row.error_message,
      timestamp: new Date(row.created_at).toISOString(),
    })),
  };
}

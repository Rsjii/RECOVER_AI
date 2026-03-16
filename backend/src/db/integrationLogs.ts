import { pool } from '../config/database';
import { SkippedInvoiceDetail } from '../types/stripe';

export interface LogIntegrationSyncInput {
  companyId: string;
  integration: 'stripe' | 'quickbooks' | 'chargebee';
  action: 'sync';
  status: 'success' | 'error';
  recordsCount: number;
  errorMessage?: string;
  details?: {
    created: number;
    updated: number;
    skipped: number;
    skippedDetails: SkippedInvoiceDetail[];
  };
}

export interface IntegrationLogRow {
  id: string;
  integration: string;
  action: string;
  status: string;
  records_count: number;
  error_message: string | null;
  details: {
    created: number;
    updated: number;
    skipped: number;
    skippedDetails: SkippedInvoiceDetail[];
  } | null;
  created_at: string;
}

export async function logIntegrationSync(input: LogIntegrationSyncInput): Promise<void> {
  await pool.query(
    `INSERT INTO integration_logs
       (company_id, integration, action, status, records_count, error_message, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.companyId,
      input.integration,
      input.action,
      input.status,
      input.recordsCount,
      input.errorMessage ?? null,
      input.details ? JSON.stringify(input.details) : null,
    ]
  );
}

export async function getSyncHistory(
  companyId: string,
  integration: string,
  limit = 10
): Promise<IntegrationLogRow[]> {
  const result = await pool.query(
    `SELECT id, integration, action, status, records_count, error_message, details, created_at
     FROM integration_logs
     WHERE company_id = $1 AND integration = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [companyId, integration, limit]
  );
  return result.rows;
}

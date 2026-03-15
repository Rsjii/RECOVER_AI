import { pool } from '../config/database';

export async function listFeatureFlags(companyId: string): Promise<any[]> {
  const defaultKeys = ['autonomous_sends', 'policy_bypass', 'integration_auto_retry'];
  for (const key of defaultKeys) {
    await pool.query(
      `INSERT INTO feature_flags (company_id, key, enabled, value)
       VALUES ($1,$2,false,'{}'::jsonb)
       ON CONFLICT (company_id, key) DO NOTHING`,
      [companyId, key]
    );
  }
  const result = await pool.query(
    `SELECT key, enabled, value, updated_at
     FROM feature_flags
     WHERE company_id = $1
     ORDER BY key ASC`,
    [companyId]
  );
  return result.rows;
}

export async function upsertFeatureFlag(companyId: string, key: string, enabled: boolean, value?: Record<string, unknown>): Promise<void> {
  await pool.query(
    `INSERT INTO feature_flags (company_id, key, enabled, value)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (company_id, key)
     DO UPDATE SET enabled = EXCLUDED.enabled, value = EXCLUDED.value, updated_at = NOW()`,
    [companyId, key, enabled, JSON.stringify(value || {})]
  );
}



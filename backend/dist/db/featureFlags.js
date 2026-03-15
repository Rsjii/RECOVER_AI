"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFeatureFlags = listFeatureFlags;
exports.upsertFeatureFlag = upsertFeatureFlag;
const database_1 = require("../config/database");
async function listFeatureFlags(companyId) {
    const defaultKeys = ['autonomous_sends', 'policy_bypass', 'integration_auto_retry'];
    for (const key of defaultKeys) {
        await database_1.pool.query(`INSERT INTO feature_flags (company_id, key, enabled, value)
       VALUES ($1,$2,false,'{}'::jsonb)
       ON CONFLICT (company_id, key) DO NOTHING`, [companyId, key]);
    }
    const result = await database_1.pool.query(`SELECT key, enabled, value, updated_at
     FROM feature_flags
     WHERE company_id = $1
     ORDER BY key ASC`, [companyId]);
    return result.rows;
}
async function upsertFeatureFlag(companyId, key, enabled, value) {
    await database_1.pool.query(`INSERT INTO feature_flags (company_id, key, enabled, value)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (company_id, key)
     DO UPDATE SET enabled = EXCLUDED.enabled, value = EXCLUDED.value, updated_at = NOW()`, [companyId, key, enabled, JSON.stringify(value || {})]);
}

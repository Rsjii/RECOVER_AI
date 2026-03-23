import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';

const MODULE = 'BillingOptimizationService';

export interface BillingAnomalyResult {
  anomaliesCreated: number;
  totalEstimatedImpact: number;
}

// ─── Duplicate detection ──────────────────────────────────────────────────────
// Same customer + same amount within 7 days, different invoice ID
async function detectDuplicates(companyId: string): Promise<void> {
  const { rows } = await pool.query<{
    invoice_id: string;
    duplicate_id: string;
    customer_id: string;
    amount: string;
  }>(
    `SELECT DISTINCT ON (LEAST(a.id, b.id), GREATEST(a.id, b.id))
       a.id AS invoice_id, b.id AS duplicate_id, a.customer_id, a.amount
     FROM invoices a
     JOIN invoices b
       ON a.company_id = b.company_id
      AND a.customer_id = b.customer_id
      AND a.amount = b.amount
      AND a.id <> b.id
      AND ABS(EXTRACT(EPOCH FROM (a.issued_date - b.issued_date)) / 86400) <= 7
     WHERE a.company_id = $1
       AND a.status NOT IN ('paid', 'uncollectable')
       AND a.issued_date >= NOW() - INTERVAL '90 days'`,
    [companyId]
  );

  for (const row of rows) {
    await upsertAnomaly(companyId, {
      invoice_id: row.invoice_id,
      duplicate_invoice_id: row.duplicate_id,
      customer_id: row.customer_id,
      anomaly_type: 'potential_duplicate',
      severity: 'high',
      description: `Potential duplicate invoice: same customer and amount ($${Number(row.amount).toLocaleString()}) within 7 days.`,
      estimated_impact_usd: Number(row.amount),
      metadata: { duplicate_invoice_id: row.duplicate_id },
    });
  }
}

// ─── Amount spike detection ───────────────────────────────────────────────────
// Invoice amount > customer avg + 2.5 × stddev (requires ≥3 historical invoices)
async function detectAmountSpikes(companyId: string): Promise<void> {
  const { rows } = await pool.query<{
    id: string;
    customer_id: string;
    amount: string;
    avg_amt: string;
    std_amt: string;
  }>(
    `WITH stats AS (
       SELECT customer_id,
              AVG(amount)    AS avg_amt,
              STDDEV(amount) AS std_amt
       FROM invoices
       WHERE company_id = $1
         AND issued_date >= NOW() - INTERVAL '180 days'
       GROUP BY customer_id
       HAVING COUNT(*) >= 3
     )
     SELECT i.id, i.customer_id, i.amount, s.avg_amt, s.std_amt
     FROM invoices i
     JOIN stats s ON i.customer_id = s.customer_id
     WHERE i.company_id = $1
       AND i.amount > (s.avg_amt + 2.5 * COALESCE(s.std_amt, s.avg_amt * 0.2))
       AND i.issued_date >= NOW() - INTERVAL '30 days'
       AND i.status NOT IN ('paid', 'uncollectable')`,
    [companyId]
  );

  for (const row of rows) {
    const amount = Number(row.amount);
    const avg = Number(row.avg_amt);
    const excess = amount - avg;
    const isHighSeverity = amount >= avg * 3;

    await upsertAnomaly(companyId, {
      invoice_id: row.id,
      customer_id: row.customer_id,
      anomaly_type: 'amount_spike',
      severity: isHighSeverity ? 'high' : 'medium',
      description: `Invoice amount ($${amount.toLocaleString()}) is significantly above this customer's average ($${avg.toFixed(0)}). Possible billing error.`,
      estimated_impact_usd: excess,
      metadata: { avg_amount: avg, std_amount: Number(row.std_amt) },
    });
  }
}

// ─── Billing gap detection ────────────────────────────────────────────────────
// Monthly customers who haven't been billed in 45+ days
async function detectBillingGaps(companyId: string): Promise<void> {
  const { rows } = await pool.query<{
    customer_id: string;
    last_billed: string;
    days_since_billed: string;
    avg_gap_days: string;
    avg_amount: string;
  }>(
    `WITH invoice_gaps AS (
       SELECT customer_id,
              issued_date,
              LEAD(issued_date) OVER (PARTITION BY customer_id ORDER BY issued_date) AS next_date
       FROM invoices
       WHERE company_id = $1
         AND issued_date >= NOW() - INTERVAL '180 days'
     ),
     monthly_customers AS (
       SELECT customer_id,
              COUNT(*)                                   AS invoice_count,
              AVG(EXTRACT(EPOCH FROM (next_date - issued_date)) / 86400) AS avg_gap_days
       FROM invoice_gaps
       WHERE next_date IS NOT NULL
       GROUP BY customer_id
       HAVING COUNT(*) >= 2
          AND AVG(EXTRACT(EPOCH FROM (next_date - issued_date)) / 86400) BETWEEN 20 AND 40
     )
     SELECT mc.customer_id,
            MAX(i.issued_date)                                              AS last_billed,
            EXTRACT(DAY FROM NOW() - MAX(i.issued_date))                    AS days_since_billed,
            mc.avg_gap_days,
            AVG(i.amount)                                                   AS avg_amount
     FROM monthly_customers mc
     JOIN invoices i ON i.customer_id = mc.customer_id AND i.company_id = $1
     GROUP BY mc.customer_id, mc.avg_gap_days
     HAVING EXTRACT(DAY FROM NOW() - MAX(i.issued_date)) > 45`,
    [companyId]
  );

  for (const row of rows) {
    const daysSince = Math.round(Number(row.days_since_billed));
    const avgAmount = Number(row.avg_amount);

    await upsertAnomaly(companyId, {
      customer_id: row.customer_id,
      anomaly_type: 'billing_gap',
      severity: 'medium',
      description: `Customer hasn't been billed in ${daysSince} days (expected every ~${Math.round(Number(row.avg_gap_days))} days). Possible missed invoice.`,
      estimated_impact_usd: avgAmount,
      metadata: {
        days_since_billed: daysSince,
        avg_gap_days: Number(row.avg_gap_days),
        last_billed: row.last_billed,
      },
    });
  }
}

// ─── Failed payment cluster detection ────────────────────────────────────────
// Customer with 3+ invoices having hard decline in past 30 days
async function detectFailedPaymentClusters(companyId: string): Promise<void> {
  const { rows } = await pool.query<{
    customer_id: string;
    failure_count: string;
    at_risk_amount: string;
  }>(
    `SELECT customer_id,
            COUNT(*)      AS failure_count,
            SUM(amount)   AS at_risk_amount
     FROM invoices
     WHERE company_id = $1
       AND last_decline_type IS NOT NULL
       AND updated_at >= NOW() - INTERVAL '30 days'
     GROUP BY customer_id
     HAVING COUNT(*) >= 3`,
    [companyId]
  );

  for (const row of rows) {
    const failureCount = Number(row.failure_count);
    const atRisk = Number(row.at_risk_amount);

    await upsertAnomaly(companyId, {
      customer_id: row.customer_id,
      anomaly_type: 'failed_payment_cluster',
      severity: 'high',
      description: `${failureCount} payment failures on this customer in the last 30 days. Total at-risk: $${atRisk.toLocaleString()}.`,
      estimated_impact_usd: atRisk,
      metadata: { failure_count: failureCount },
    });
  }
}

// ─── Upsert helper ────────────────────────────────────────────────────────────
// Skips if a pending anomaly of the same type already exists for the same invoice/customer
interface AnomalyInsert {
  invoice_id?: string;
  duplicate_invoice_id?: string;
  customer_id?: string;
  anomaly_type: string;
  severity: string;
  description: string;
  estimated_impact_usd: number;
  metadata?: Record<string, unknown>;
}

async function upsertAnomaly(companyId: string, data: AnomalyInsert): Promise<boolean> {
  // Check for existing pending anomaly of same type for same invoice (or customer if no invoice)
  const { rows: existing } = await pool.query<{ id: string }>(
    `SELECT id FROM billing_anomalies
     WHERE company_id = $1
       AND anomaly_type = $2
       AND status = 'pending'
       AND (
         ($3::uuid IS NOT NULL AND invoice_id = $3)
         OR ($3::uuid IS NULL AND $4::uuid IS NOT NULL AND customer_id = $4)
       )
     LIMIT 1`,
    [companyId, data.anomaly_type, data.invoice_id ?? null, data.customer_id ?? null]
  );

  if (existing.length > 0) return false; // already tracked

  await pool.query(
    `INSERT INTO billing_anomalies
       (company_id, invoice_id, duplicate_invoice_id, customer_id, anomaly_type,
        severity, description, estimated_impact_usd, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      companyId,
      data.invoice_id ?? null,
      data.duplicate_invoice_id ?? null,
      data.customer_id ?? null,
      data.anomaly_type,
      data.severity,
      data.description,
      data.estimated_impact_usd,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ]
  );

  return true;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function runBillingOptimization(companyId: string): Promise<BillingAnomalyResult> {
  logInfo(MODULE, 'runBillingOptimization', 'Starting scan', { companyId });

  const countBefore = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM billing_anomalies WHERE company_id = $1 AND status = 'pending'`,
    [companyId]
  );
  const before = Number(countBefore.rows[0]?.count ?? 0);

  await detectDuplicates(companyId);
  await detectAmountSpikes(companyId);
  await detectBillingGaps(companyId);
  await detectFailedPaymentClusters(companyId);

  const { rows } = await pool.query<{ count: string; total: string }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(estimated_impact_usd), 0) AS total
     FROM billing_anomalies
     WHERE company_id = $1 AND status = 'pending'`,
    [companyId]
  );

  const after = Number(rows[0]?.count ?? 0);
  const anomaliesCreated = after - before;
  const totalEstimatedImpact = Number(rows[0]?.total ?? 0);

  logInfo(MODULE, 'runBillingOptimization', 'Scan complete', {
    companyId,
    anomaliesCreated,
    totalEstimatedImpact,
  });

  return { anomaliesCreated, totalEstimatedImpact };
}

import { pool } from '../config/database';
import { CustomerRow } from '../types/database';

export interface CreateCustomerInput {
  companyId: string;
  name: string;
  email: string;
  companyName?: string;
  phone?: string;
}

export async function findOrCreateCustomer(input: CreateCustomerInput): Promise<CustomerRow> {
  const { companyId, name, email, companyName, phone } = input;

  const existing = await pool.query(
    'SELECT * FROM customers WHERE company_id = $1 AND email = $2',
    [companyId, email]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO customers (company_id, name, email, company_name, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [companyId, name, email, companyName || null, phone || null]
  );

  return result.rows[0];
}

export async function findCustomerById(id: string, companyId: string): Promise<CustomerRow | null> {
  const result = await pool.query(
    'SELECT * FROM customers WHERE id = $1 AND company_id = $2',
    [id, companyId]
  );
  return result.rows[0] || null;
}

export async function listCustomers(
  companyId: string,
  limit = 50,
  offset = 0,
  riskTier?: string
): Promise<{ data: CustomerRow[]; total: number }> {
  let riskFilter = '';
  // Filter by calculated customer_risk_score (0-100), not invoice risk_score
  if (riskTier === 'high') riskFilter = 'WHERE c.customer_risk_score > 60';
  else if (riskTier === 'medium') riskFilter = 'WHERE c.customer_risk_score BETWEEN 30 AND 60';
  else if (riskTier === 'low') riskFilter = 'WHERE c.customer_risk_score > 0 AND c.customer_risk_score < 30';
  else if (riskTier === 'none') riskFilter = 'WHERE c.customer_risk_score = 0';

  const baseQuery = `
    SELECT c.*,
      MAX(i.risk_score) AS max_risk_score,
      MAX(i.last_decline_type) AS last_decline_type,
      COALESCE(SUM(CASE WHEN i.status NOT IN ('paid','uncollectable') THEN i.amount ELSE 0 END), 0) AS total_ar_balance,
      MAX(p.paid_at) AS last_payment_date
    FROM customers c
    LEFT JOIN invoices i ON i.customer_id = c.id AND i.company_id = c.company_id
    LEFT JOIN payments p ON p.invoice_id = i.id AND p.company_id = c.company_id
    WHERE c.company_id = $1
      ${riskFilter ? `AND ${riskFilter.replace('WHERE ', '')}` : ''}
    GROUP BY c.id
  `;

  const [data, count] = await Promise.all([
    pool.query(`${baseQuery} ORDER BY c.created_at DESC LIMIT $2 OFFSET $3`, [companyId, limit, offset]),
    pool.query(`SELECT COUNT(*) FROM (${baseQuery}) AS sub`, [companyId]),
  ]);

  return { data: data.rows, total: parseInt(count.rows[0].count) };
}

/**
 * Set or update a customer's phone number and SMS opt-in status.
 * TCPA requires explicit opt-in before any SMS can be sent.
 */
export async function updateCustomerPhone(
  id: string,
  companyId: string,
  phone: string,
  optIn: boolean
): Promise<void> {
  await pool.query(
    `UPDATE customers SET phone = $1, phone_opt_in = $2, updated_at = NOW()
     WHERE id = $3 AND company_id = $4`,
    [phone, optIn, id, companyId]
  );
}

/**
 * Mark a customer as opted out of SMS (STOP reply handler).
 * Looks up by phone number across all companies.
 */
export async function handleSMSOptOut(phoneNumber: string): Promise<void> {
  await pool.query(
    `UPDATE customers SET phone_opt_in = false, updated_at = NOW()
     WHERE phone = $1`,
    [phoneNumber]
  );
}

/**
 * Update customer email (permanent change to DB)
 */
export async function updateCustomer(id: string, companyId: string, data: { email: string }): Promise<CustomerRow> {
  const result = await pool.query(
    `UPDATE customers
     SET email = $1, updated_at = NOW()
     WHERE id = $2 AND company_id = $3
     RETURNING *`,
    [data.email, id, companyId]
  );

  if (result.rows.length === 0) {
    throw new Error('Customer not found or not authorized');
  }

  return result.rows[0];
}

/**
 * Recompute and persist customer payment_history from actual invoice/payment data
 */
export async function updateCustomerPaymentHistory(customerId: string): Promise<void> {
  // Count totals from invoices
  const stats = await pool.query(
    `SELECT
       COUNT(*) as total_invoices,
       COUNT(CASE WHEN status = 'paid' THEN 1 END) as total_paid
     FROM invoices
     WHERE customer_id = $1`,
    [customerId]
  );

  const { total_invoices, total_paid } = stats.rows[0];
  const totalInv = parseInt(total_invoices);
  const totalPaid = parseInt(total_paid);
  const onTimeRate = totalInv > 0 ? Math.round((totalPaid / totalInv) * 100) : 0;

  // Avg days late from payments vs due dates
  const avgResult = await pool.query(
    `SELECT AVG(
       GREATEST(0, EXTRACT(EPOCH FROM (p.paid_at - i.due_date)) / 86400)
     ) as avg_days_late
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     WHERE i.customer_id = $1 AND p.status = 'succeeded'`,
    [customerId]
  );

  const avgDaysLate = Math.round(parseFloat(avgResult.rows[0]?.avg_days_late || '0'));

  await pool.query(
    `UPDATE customers
     SET payment_history = $1::jsonb,
         updated_at = NOW()
     WHERE id = $2`,
    [
      JSON.stringify({ total_invoices: totalInv, total_paid: totalPaid, on_time_rate: onTimeRate, avg_days_late: avgDaysLate }),
      customerId,
    ]
  );
}

/**
 * Update the risk_tier for a customer and log the change if tier changed.
 */
export async function updateCustomerTier(
  customerId: string,
  companyId: string,
  newTier: number,
  reason?: string
): Promise<void> {
  // Fetch current tier first to detect change
  const current = await pool.query(
    'SELECT risk_tier FROM customers WHERE id = $1 AND company_id = $2',
    [customerId, companyId]
  );
  if (current.rows.length === 0) return;

  const oldTier = current.rows[0].risk_tier;

  await pool.query(
    `UPDATE customers
     SET risk_tier = $1, risk_tier_updated_at = NOW(), updated_at = NOW()
     WHERE id = $2 AND company_id = $3`,
    [newTier, customerId, companyId]
  );

  if (oldTier !== newTier) {
    await pool.query(
      `INSERT INTO customer_tier_history (customer_id, company_id, old_tier, new_tier, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [customerId, companyId, oldTier, newTier, reason ?? 'scheduled_recalculation']
    ).catch(() => {});  // non-blocking
  }
}

/**
 * List customers grouped by tier for a company.
 */
export async function listCustomersByTier(
  companyId: string
): Promise<{ tier: number; customers: Array<{ id: string; name: string; email: string; risk_tier: number }> }[]> {
  const result = await pool.query(
    `SELECT id, name, email, COALESCE(risk_tier, 2) AS risk_tier
     FROM customers
     WHERE company_id = $1
     ORDER BY risk_tier ASC, name ASC`,
    [companyId]
  );

  const groups: Record<number, typeof result.rows> = { 1: [], 2: [], 3: [], 4: [] };
  for (const row of result.rows) {
    const t = Math.min(4, Math.max(1, Number(row.risk_tier)));
    groups[t].push(row);
  }

  return [1, 2, 3, 4].map(tier => ({ tier, customers: groups[tier] }));
}

/**
 * Get tier distribution counts for a company.
 */
export async function getCustomerTierDistribution(companyId: string): Promise<Record<number, number>> {
  const result = await pool.query(
    `SELECT COALESCE(risk_tier, 2) AS tier, COUNT(*)::int AS count
     FROM customers
     WHERE company_id = $1
     GROUP BY 1`,
    [companyId]
  );

  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const row of result.rows) {
    const t = Math.min(4, Math.max(1, Number(row.tier)));
    dist[t] = row.count;
  }
  return dist;
}

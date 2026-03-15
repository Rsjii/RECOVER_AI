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
  offset = 0
): Promise<{ data: CustomerRow[]; total: number }> {
  const [data, count] = await Promise.all([
    pool.query(
      'SELECT * FROM customers WHERE company_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [companyId, limit, offset]
    ),
    pool.query('SELECT COUNT(*) FROM customers WHERE company_id = $1', [companyId]),
  ]);

  return { data: data.rows, total: parseInt(count.rows[0].count) };
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

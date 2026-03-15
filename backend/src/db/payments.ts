import { pool } from '../config/database';
import { PaymentRow } from '../types/database';

export interface CreatePaymentInput {
  invoiceId: string;
  companyId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paidAt: Date;
  stripeChargeId?: string;
  status?: 'pending' | 'succeeded' | 'failed';
  notes?: string;
}

export async function createPayment(input: CreatePaymentInput): Promise<PaymentRow> {
  const {
    invoiceId, companyId, amount, currency, paymentMethod,
    paidAt, stripeChargeId, status = 'succeeded', notes,
  } = input;

  const result = await pool.query(
    `INSERT INTO payments
       (invoice_id, company_id, amount, currency, payment_method, paid_at, stripe_charge_id, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [invoiceId, companyId, amount, currency, paymentMethod,
     paidAt, stripeChargeId || null, status, notes || null]
  );
  return result.rows[0];
}

export async function listPaymentsByInvoice(invoiceId: string, companyId: string): Promise<PaymentRow[]> {
  const result = await pool.query(
    `SELECT *
     FROM payments
     WHERE invoice_id = $1
       AND company_id = $2
     ORDER BY paid_at DESC`,
    [invoiceId, companyId]
  );
  return result.rows;
}

export async function listPaymentsByCompany(
  companyId: string,
  limit = 50,
  offset = 0
): Promise<{ data: PaymentRow[]; total: number }> {
  const [data, count] = await Promise.all([
    pool.query(
      'SELECT * FROM payments WHERE company_id = $1 ORDER BY paid_at DESC LIMIT $2 OFFSET $3',
      [companyId, limit, offset]
    ),
    pool.query('SELECT COUNT(*) FROM payments WHERE company_id = $1', [companyId]),
  ]);
  return { data: data.rows, total: parseInt(count.rows[0].count) };
}

export async function findPaymentByStripeChargeId(stripeChargeId: string): Promise<PaymentRow | null> {
  const result = await pool.query(
    'SELECT * FROM payments WHERE stripe_charge_id = $1 LIMIT 1',
    [stripeChargeId]
  );
  return result.rows[0] || null;
}

export async function countEmailsSentToday(companyId: string): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) FROM payments
     WHERE company_id = $1
       AND paid_at >= NOW() - INTERVAL '24 hours'
       AND status = 'succeeded'`,
    [companyId]
  );
  return parseInt(result.rows[0].count);
}

import { pool } from '../config/database';
import { PaymentPlanRow } from '../types/database';

export interface Installment {
  amount: number;
  due_date: string;    // ISO string
  paid: boolean;
  stripe_payment_intent_id?: string;
}

export interface CreatePaymentPlanInput {
  invoiceId: string;
  installments: Installment[];
  totalAmount: number;
}

export async function createPaymentPlan(input: CreatePaymentPlanInput): Promise<PaymentPlanRow> {
  const { invoiceId, installments, totalAmount } = input;

  const result = await pool.query(
    `INSERT INTO payment_plans (invoice_id, status, installments, total_amount)
     VALUES ($1, 'active', $2::jsonb, $3)
     RETURNING *`,
    [invoiceId, JSON.stringify(installments), totalAmount]
  );

  return result.rows[0];
}

export async function findPaymentPlanByInvoice(invoiceId: string, companyId: string): Promise<PaymentPlanRow | null> {
  const result = await pool.query(
    `SELECT pp.*
     FROM payment_plans pp
     JOIN invoices i ON i.id = pp.invoice_id
     WHERE pp.invoice_id = $1
       AND i.company_id = $2
     ORDER BY pp.created_at DESC
     LIMIT 1`,
    [invoiceId, companyId]
  );
  return result.rows[0] || null;
}

export async function findPaymentPlanById(planId: string, companyId: string): Promise<PaymentPlanRow | null> {
  const result = await pool.query(
    `SELECT pp.*
     FROM payment_plans pp
     JOIN invoices i ON i.id = pp.invoice_id
     WHERE pp.id = $1
       AND i.company_id = $2
     LIMIT 1`,
    [planId, companyId]
  );
  return result.rows[0] || null;
}

export async function updateInstallmentPaid(
  planId: string,
  installmentIndex: number,
  stripePaymentIntentId: string
): Promise<PaymentPlanRow> {
  // Update the specific installment in the JSONB array
  const result = await pool.query(
    `UPDATE payment_plans
     SET installments = jsonb_set(
       installments,
       ARRAY[$1::text],
       installments->$1::int || '{"paid": true}'::jsonb || jsonb_build_object('stripe_payment_intent_id', $2),
       false
     ),
     updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [installmentIndex, stripePaymentIntentId, planId]
  );
  return result.rows[0];
}

export async function updatePaymentPlanStatus(
  planId: string,
  companyId: string,
  status: 'active' | 'completed' | 'defaulted'
): Promise<PaymentPlanRow> {
  const result = await pool.query(
    `UPDATE payment_plans pp
     SET status = $1, updated_at = NOW()
     FROM invoices i
     WHERE pp.id = $2
       AND i.id = pp.invoice_id
       AND i.company_id = $3
     RETURNING pp.*`,
    [status, planId, companyId]
  );
  return result.rows[0];
}

export async function listPaymentPlans(companyId: string): Promise<PaymentPlanRow[]> {
  const result = await pool.query(
    `SELECT pp.*
     FROM payment_plans pp
     JOIN invoices i ON pp.invoice_id = i.id
     WHERE i.company_id = $1
     ORDER BY pp.created_at DESC`,
    [companyId]
  );
  return result.rows;
}

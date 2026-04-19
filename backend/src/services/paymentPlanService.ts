import { pool } from '../config/database';
import { randomUUID } from 'crypto';
import { logInfo } from '../utils/logger';

const MODULE = 'PaymentPlanService';

interface PaymentPlan {
  id: string;
  company_id: string;
  invoice_id: string;
  customer_id: string;
  original_amount: number;
  installment_count: number;
  installment_amount: number;
  first_payment_due: string;
  next_payment_due: string;
  status: 'pending' | 'accepted' | 'active' | 'completed' | 'failed';
  acceptance_token: string;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface PaymentPlanCharge {
  id: string;
  plan_id: string;
  charge_number: number;
  amount: number;
  due_date: string;
  razorpay_charge_id: string | null;
  status: 'pending' | 'charged' | 'failed';
  retry_count: number;
  charged_at: string | null;
  created_at: string;
}

/**
 * Calculate installment count based on risk tier
 * Tier 1 (green) = 3 months, Tier 2 (yellow) = 4 months, Tier 3 (orange) = 5 months, Tier 4 (red) = 6 months
 */
function calculateInstallmentCount(riskTier: 1 | 2 | 3 | 4): number {
  const tierToCount: Record<1 | 2 | 3 | 4, number> = {
    1: 3,
    2: 4,
    3: 5,
    4: 6
  };
  return tierToCount[riskTier] || 4;
}

/**
 * DEPRECATED: Backwards compatibility wrapper
 * Use createAutoPaymentPlan directly with proper parameters instead
 */
export async function createPlanForInvoice(
  invoiceId: string,
  companyId: string,
  numInstallments: number
): Promise<PaymentPlan> {
  // Fetch invoice details from database (with customer risk_tier)
  const invoiceResult = await pool.query(
    `SELECT i.id, i.customer_id, i.amount, c.risk_tier FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     WHERE i.id = $1 AND i.company_id = $2`,
    [invoiceId, companyId]
  );

  if (invoiceResult.rows.length === 0) {
    throw new Error('Invoice not found');
  }

  const invoice = invoiceResult.rows[0];
  const riskTier = Math.min(4, Math.max(1, invoice.risk_tier || 2)) as 1 | 2 | 3 | 4;

  return createAutoPaymentPlan(
    invoiceId,
    invoice.customer_id,
    companyId,
    parseFloat(invoice.amount),
    riskTier
  );
}

/**
 * Create automatic payment plan on hard decline
 * Calculates installments, generates acceptance token, creates charge records
 */
export async function createAutoPaymentPlan(
  invoiceId: string,
  customerId: string,
  companyId: string,
  originalAmount: number,
  riskTier: 1 | 2 | 3 | 4
): Promise<PaymentPlan> {
  const planId = randomUUID();
  const acceptanceToken = randomUUID();
  const installmentCount = calculateInstallmentCount(riskTier);
  const installmentAmount = Math.round((originalAmount / installmentCount) * 100) / 100;

  const now = new Date();
  const firstPaymentDue = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  try {
    await pool.query('BEGIN');

    // Create payment plan
    const planResult = await pool.query(
      `INSERT INTO payment_plans (
        id, company_id, invoice_id, customer_id, original_amount,
        installment_count, installment_amount, first_payment_due, next_payment_due,
        status, acceptance_token, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *`,
      [
        planId,
        companyId,
        invoiceId,
        customerId,
        originalAmount,
        installmentCount,
        installmentAmount,
        firstPaymentDue.toISOString(),
        firstPaymentDue.toISOString(),
        'pending',
        acceptanceToken
      ]
    );

    // Create charge records (one per installment)
    for (let i = 1; i <= installmentCount; i++) {
      const chargeDueDate = new Date(firstPaymentDue.getTime() + (i - 1) * 30 * 24 * 60 * 60 * 1000);
      await pool.query(
        `INSERT INTO payment_plan_charges (
          id, plan_id, charge_number, amount, due_date, status, retry_count, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          randomUUID(),
          planId,
          i,
          installmentAmount,
          chargeDueDate.toISOString(),
          'pending',
          0
        ]
      );
    }

    await pool.query('COMMIT');

    logInfo(MODULE, 'createAutoPaymentPlan', `Created plan ${planId} for invoice ${invoiceId}`, {
      installmentCount,
      installmentAmount,
      originalAmount
    });

    return planResult.rows[0];
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}

/**
 * Accept payment plan by token
 * Marks plan as active, records acceptance time, sends SMS confirmation
 */
export async function acceptPaymentPlan(planId: string, acceptanceToken: string): Promise<PaymentPlan> {
  const result = await pool.query(
    `UPDATE payment_plans
     SET status = $1, accepted_at = NOW(), acceptance_token = NULL
     WHERE id = $2 AND acceptance_token = $3
     RETURNING *`,
    ['active', planId, acceptanceToken]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid plan or token');
  }

  const plan = result.rows[0];

  logInfo(MODULE, 'acceptPaymentPlan', `Plan ${planId} accepted by customer`, {
    customerId: plan.customer_id,
    originalAmount: plan.original_amount
  });

  return plan;
}

/**
 * Get payment plan statistics for company dashboard
 */
export async function getPaymentPlanStats(
  companyId: string,
  daysBack: number = 30
): Promise<{
  active_plans: number;
  completed_plans: number;
  total_recovered: number;
  acceptance_rate: number;
  pending_charges: number;
}> {
  const dateThreshold = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const statsResult = await pool.query(
    `SELECT
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_plans,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_plans,
      COALESCE(SUM(CASE WHEN status IN ('active', 'completed') THEN original_amount ELSE 0 END), 0) as total_recovered,
      COUNT(CASE WHEN status IN ('accepted', 'active', 'completed') THEN 1 END)::float /
        NULLIF(COUNT(*), 0) as acceptance_rate
     FROM payment_plans
     WHERE company_id = $1 AND created_at >= $2`,
    [companyId, dateThreshold.toISOString()]
  );

  const chargesResult = await pool.query(
    `SELECT COUNT(*) as pending_charges FROM payment_plan_charges
     WHERE plan_id IN (
       SELECT id FROM payment_plans WHERE company_id = $1
     ) AND status = 'pending' AND due_date <= NOW()`,
    [companyId]
  );

  const stats = statsResult.rows[0];
  return {
    active_plans: parseInt(stats.active_plans, 10),
    completed_plans: parseInt(stats.completed_plans, 10),
    total_recovered: parseFloat(stats.total_recovered),
    acceptance_rate: Math.round((parseFloat(stats.acceptance_rate) || 0) * 100),
    pending_charges: parseInt(chargesResult.rows[0].pending_charges, 10)
  };
}

/**
 * Get recent payment plans for dashboard
 */
export async function getRecentPaymentPlans(
  companyId: string,
  limit: number = 5
): Promise<PaymentPlan[]> {
  const result = await pool.query(
    `SELECT * FROM payment_plans
     WHERE company_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [companyId, limit]
  );

  return result.rows;
}

/**
 * Get full payment plan details including charges
 */
export async function getPaymentPlanById(
  planId: string,
  companyId: string
): Promise<PaymentPlan & { charges: PaymentPlanCharge[] }> {
  const planResult = await pool.query(
    `SELECT * FROM payment_plans WHERE id = $1 AND company_id = $2`,
    [planId, companyId]
  );

  if (planResult.rows.length === 0) {
    throw new Error('Payment plan not found');
  }

  const chargesResult = await pool.query(
    `SELECT * FROM payment_plan_charges WHERE plan_id = $1 ORDER BY charge_number ASC`,
    [planId]
  );

  return {
    ...planResult.rows[0],
    charges: chargesResult.rows
  };
}

/**
 * Mark payment plan as completed
 */
export async function completePaymentPlan(planId: string, companyId: string): Promise<PaymentPlan> {
  const result = await pool.query(
    `UPDATE payment_plans
     SET status = $1, completed_at = NOW()
     WHERE id = $2 AND company_id = $3
     RETURNING *`,
    ['completed', planId, companyId]
  );

  if (result.rows.length === 0) {
    throw new Error('Payment plan not found');
  }

  logInfo(MODULE, 'completePaymentPlan', `Plan ${planId} marked as completed`, {});

  return result.rows[0];
}

/**
 * Get pending charges due for payment
 */
export async function getPendingChargesDue(companyId: string): Promise<PaymentPlanCharge[]> {
  const result = await pool.query(
    `SELECT ppc.* FROM payment_plan_charges ppc
     JOIN payment_plans pp ON ppc.plan_id = pp.id
     WHERE pp.company_id = $1
       AND ppc.status = 'pending'
       AND ppc.due_date <= NOW()
       AND ppc.retry_count < 3
     ORDER BY ppc.due_date ASC`,
    [companyId]
  );

  return result.rows;
}

/**
 * Record charge attempt result
 */
export async function recordChargeAttempt(
  chargeId: string,
  razorpayChargeId: string | null,
  success: boolean
): Promise<void> {
  const newStatus = success ? 'charged' : 'failed';
  const retryCount = success ? 0 : 1;

  await pool.query(
    `UPDATE payment_plan_charges
     SET status = $1,
         razorpay_charge_id = $2,
         retry_count = retry_count + $3,
         charged_at = CASE WHEN $1 = 'charged' THEN NOW() ELSE charged_at END
     WHERE id = $4`,
    [newStatus, razorpayChargeId, retryCount, chargeId]
  );

  logInfo(MODULE, 'recordChargeAttempt', `Charge ${chargeId} ${newStatus}`, {
    razorpayChargeId
  });
}

/**
 * Get payment plans summary for dashboard
 */
export async function getPaymentPlansSummary(companyId: string): Promise<{
  activePlans: number;
  completedPlans: number;
  defaultedPlans: number;
  totalOffered: number;
  acceptanceRate: number;
  completionRate: number;
  totalValueActive: number;
  recentPlans: Array<{
    planId: string;
    customerName: string;
    totalAmount: number;
    status: string;
    installmentsTotal: number;
    installmentsPaid: number;
    pctComplete: number;
  }>;
}> {
  // Get plan counts and rates
  const statsResult = await pool.query(
    `SELECT
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_plans,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_plans,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as defaulted_plans,
      COUNT(*) as total_offered,
      COUNT(CASE WHEN status IN ('accepted', 'active', 'completed') THEN 1 END)::float /
        NULLIF(COUNT(*), 0) as acceptance_rate,
      COUNT(CASE WHEN status = 'completed' THEN 1 END)::float /
        NULLIF(COUNT(CASE WHEN status IN ('active', 'completed') THEN 1 END), 0) as completion_rate,
      COALESCE(SUM(CASE WHEN status = 'active' THEN original_amount ELSE 0 END), 0) as total_value_active
     FROM payment_plans
     WHERE company_id = $1`,
    [companyId]
  );

  const stats = statsResult.rows[0];

  // Get recent plans with customer info
  const recentResult = await pool.query(
    `SELECT
      pp.id as plan_id,
      c.company_name as customer_name,
      pp.original_amount as total_amount,
      pp.status,
      pp.installment_count as installments_total,
      (SELECT COUNT(*) FROM payment_plan_charges ppc WHERE ppc.plan_id = pp.id AND ppc.status = 'charged') as installments_paid
     FROM payment_plans pp
     JOIN customers c ON c.id = pp.customer_id
     WHERE pp.company_id = $1
     ORDER BY pp.created_at DESC
     LIMIT 5`,
    [companyId]
  );

  const recentPlans = recentResult.rows.map(plan => ({
    planId: plan.plan_id,
    customerName: plan.customer_name,
    totalAmount: parseFloat(plan.total_amount),
    status: plan.status,
    installmentsTotal: plan.installments_total,
    installmentsPaid: parseInt(plan.installments_paid, 10),
    pctComplete: plan.installments_total > 0
      ? Math.round((parseInt(plan.installments_paid, 10) / plan.installments_total) * 100)
      : 0
  }));

  return {
    activePlans: parseInt(stats.active_plans, 10),
    completedPlans: parseInt(stats.completed_plans, 10),
    defaultedPlans: parseInt(stats.defaulted_plans, 10),
    totalOffered: parseInt(stats.total_offered, 10),
    acceptanceRate: Math.round((parseFloat(stats.acceptance_rate) || 0) * 100),
    completionRate: Math.round((parseFloat(stats.completion_rate) || 0) * 100),
    totalValueActive: parseFloat(stats.total_value_active),
    recentPlans
  };
}

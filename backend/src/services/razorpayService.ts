import Razorpay from 'razorpay';
import crypto from 'crypto';
import { pool } from '../config/database';
import { config } from '../config/env';
import { logInfo, logError, logWarn } from '../utils/logger';

const MODULE = 'razorpayService';

function getRazorpayClient(): Razorpay {
  const keyId = config.razorpay.keyId;
  const keySecret = config.razorpay.keySecret;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// ============================================================
// CUSTOMER MANAGEMENT
// ============================================================

export async function createOrGetRazorpayCustomer(params: {
  companyId: string;
  name: string;
  email: string;
  phone?: string;
}): Promise<string> {
  const fn = 'createOrGetRazorpayCustomer';

  // Return cached ID if exists
  const existing = await pool.query(
    'SELECT razorpay_customer_id FROM companies WHERE id = $1',
    [params.companyId]
  );
  if (existing.rows[0]?.razorpay_customer_id) {
    return existing.rows[0].razorpay_customer_id as string;
  }

  const rzp = getRazorpayClient();
  const customer = await rzp.customers.create({
    name: params.name,
    email: params.email,
    contact: params.phone || '',
    notes: { company_id: params.companyId },
  });

  await pool.query(
    'UPDATE companies SET razorpay_customer_id = $1, updated_at = NOW() WHERE id = $2',
    [customer.id, params.companyId]
  );

  logInfo(MODULE, fn, 'Razorpay customer created', { companyId: params.companyId, customerId: customer.id });
  return customer.id;
}

// ============================================================
// PAYMENT LINKS (custom invoice payment)
// ============================================================

export interface CreatePaymentLinkParams {
  companyId: string;
  billingInvoiceId: string;
  invoiceNumber: string;
  amountUsd: number;
  customerEmail: string;
  customerName: string;
  description: string;
  currency?: string;
}

export interface PaymentLinkResult {
  linkId: string;
  url: string;
  amountPaise: number;
}

export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult> {
  const fn = 'createPaymentLink';
  const rzp = getRazorpayClient();

  const currency = params.currency || 'USD';
  // Razorpay uses smallest currency unit (paise for INR, cents for USD)
  const amountSmallest = Math.round(params.amountUsd * 100);

  const link = await (rzp.paymentLink as any).create({
    amount: amountSmallest,
    currency,
    accept_partial: false,
    description: params.description,
    customer: {
      name: params.customerName,
      email: params.customerEmail,
    },
    notify: {
      sms: false,
      email: true,
    },
    reminder_enable: true,
    notes: {
      company_id: params.companyId,
      billing_invoice_id: params.billingInvoiceId,
      invoice_number: params.invoiceNumber,
    },
    callback_url: `${config.frontendUrl}/billing/payment-success`,
    callback_method: 'get',
  });

  // Persist link ID + URL to billing_invoices
  await pool.query(
    `UPDATE billing_invoices
     SET razorpay_payment_link_id = $1, razorpay_payment_link_url = $2, status = 'open', updated_at = NOW()
     WHERE id = $3`,
    [link.id, link.short_url, params.billingInvoiceId]
  );

  logInfo(MODULE, fn, 'Payment link created', {
    companyId: params.companyId,
    invoiceId: params.billingInvoiceId,
    linkId: link.id,
    amount: params.amountUsd,
    currency,
  });

  return { linkId: link.id, url: link.short_url, amountPaise: amountSmallest };
}

// ============================================================
// MONTHLY INVOICE GENERATION (base fee + recovery %)
// ============================================================

export interface GenerateMonthlyInvoiceParams {
  companyId: string;
  customerName: string;
  customerEmail: string;
  baseFeeUsd: number;
  recoveredAmountUsd: number;
  recoveryPercentage: number;       // e.g. 1.2 for 1.2%
  periodStart: Date;
  periodEnd: Date;
  currency?: string;
}

export interface MonthlyInvoiceResult {
  billingInvoiceId: string;
  invoiceNumber: string;
  baseFeeUsd: number;
  recoveryFeeUsd: number;
  totalUsd: number;
  paymentLinkUrl: string;
}

export async function generateMonthlyInvoice(params: GenerateMonthlyInvoiceParams): Promise<MonthlyInvoiceResult> {
  const fn = 'generateMonthlyInvoice';

  const recoveryFeeUsd = Number(((params.recoveredAmountUsd * params.recoveryPercentage) / 100).toFixed(2));
  const totalUsd = Number((params.baseFeeUsd + recoveryFeeUsd).toFixed(2));

  const year = params.periodStart.getUTCFullYear();
  const month = String(params.periodStart.getUTCMonth() + 1).padStart(2, '0');
  const invoiceNumber = `INV-${year}-${month}-${params.companyId.slice(0, 6).toUpperCase()}`;

  const lineItems = [
    { description: `Base platform fee (${params.periodStart.toISOString().slice(0, 7)})`, amount: params.baseFeeUsd },
    {
      description: `Recovery fee (${params.recoveryPercentage}% of $${params.recoveredAmountUsd.toLocaleString()} recovered)`,
      amount: recoveryFeeUsd,
    },
  ];

  // Upsert billing_invoice record
  const invoiceRes = await pool.query(
    `INSERT INTO billing_invoices
       (company_id, period_start, period_end, base_amount_usd, success_fee_amount_usd, total_amount_usd, status, line_items, due_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8)
     ON CONFLICT (company_id, period_start) DO UPDATE SET
       success_fee_amount_usd = EXCLUDED.success_fee_amount_usd,
       total_amount_usd       = EXCLUDED.total_amount_usd,
       line_items             = EXCLUDED.line_items,
       updated_at             = NOW()
     RETURNING id`,
    [
      params.companyId,
      params.periodStart.toISOString().slice(0, 10),
      params.periodEnd.toISOString().slice(0, 10),
      params.baseFeeUsd,
      recoveryFeeUsd,
      totalUsd,
      JSON.stringify(lineItems),
      new Date(params.periodEnd.getTime() + 7 * 24 * 60 * 60 * 1000), // due 7 days after period end
    ]
  );

  const billingInvoiceId = invoiceRes.rows[0].id as string;

  // Create Razorpay payment link
  const description = `RecoverAI Invoice ${invoiceNumber} – ${params.periodStart.toISOString().slice(0, 7)}`;
  const linkResult = await createPaymentLink({
    companyId: params.companyId,
    billingInvoiceId,
    invoiceNumber,
    amountUsd: totalUsd,
    customerEmail: params.customerEmail,
    customerName: params.customerName,
    description,
    currency: params.currency,
  });

  logInfo(MODULE, fn, 'Monthly invoice generated', {
    companyId: params.companyId,
    invoiceNumber,
    baseFeeUsd: params.baseFeeUsd,
    recoveryFeeUsd,
    totalUsd,
    paymentLinkUrl: linkResult.url,
  });

  return {
    billingInvoiceId,
    invoiceNumber,
    baseFeeUsd: params.baseFeeUsd,
    recoveryFeeUsd,
    totalUsd,
    paymentLinkUrl: linkResult.url,
  };
}

// ============================================================
// WEBHOOK VALIDATION + HANDLING
// ============================================================

export function validateWebhookSignature(body: string, signature: string): boolean {
  const secret = config.razorpay.webhookSecret;
  if (!secret) {
    logWarn(MODULE, 'validateWebhookSignature', 'RAZORPAY_WEBHOOK_SECRET not set — skipping validation');
    return true;
  }
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

export async function handleWebhookEvent(event: Record<string, any>): Promise<void> {
  const fn = 'handleWebhookEvent';
  const eventType = event.event as string;

  logInfo(MODULE, fn, 'Processing webhook', { eventType });

  switch (eventType) {
    case 'payment_link.paid': {
      const linkId = event.payload?.payment_link?.entity?.id as string;
      const billingInvoiceId = event.payload?.payment_link?.entity?.notes?.billing_invoice_id as string;
      if (billingInvoiceId) {
        await pool.query(
          `UPDATE billing_invoices SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [billingInvoiceId]
        );
        logInfo(MODULE, fn, 'Invoice marked paid', { billingInvoiceId, linkId });
      }
      break;
    }

    case 'payment_link.expired':
    case 'payment_link.cancelled': {
      const billingInvoiceId = event.payload?.payment_link?.entity?.notes?.billing_invoice_id as string;
      if (billingInvoiceId) {
        await pool.query(
          `UPDATE billing_invoices SET status = 'void', updated_at = NOW() WHERE id = $1`,
          [billingInvoiceId]
        );
        logInfo(MODULE, fn, 'Invoice voided', { billingInvoiceId, eventType });
      }
      break;
    }

    default:
      logInfo(MODULE, fn, 'Unhandled webhook event', { eventType });
  }
}

// ============================================================
// ADMIN: GENERATE ALL MONTHLY INVOICES (bulk run)
// ============================================================

export interface BulkInvoiceResult {
  companyId: string;
  companyName: string;
  invoiceNumber: string;
  totalUsd: number;
  paymentLinkUrl: string;
  status: 'generated' | 'skipped' | 'error';
  error?: string;
}

export async function generateAllMonthlyInvoices(periodStart: Date, periodEnd: Date): Promise<BulkInvoiceResult[]> {
  const fn = 'generateAllMonthlyInvoices';

  // Get all active companies with billing tier set
  const companiesRes = await pool.query<{
    id: string;
    name: string;
    email: string;
    billing_tier: number;
    recovery_percentage: string;
    razorpay_customer_id: string | null;
  }>(
    `SELECT c.id, c.name, c.email, c.billing_tier, c.recovery_percentage, c.razorpay_customer_id
     FROM companies c
     JOIN subscriptions s ON s.company_id = c.id
     WHERE s.status IN ('active', 'trialing')
       AND c.billing_tier IS NOT NULL
     ORDER BY c.name`
  );

  const results: BulkInvoiceResult[] = [];

  for (const company of companiesRes.rows) {
    try {
      // Calculate total recovered this period
      const recoveredRes = await pool.query<{ total: string }>(
        `SELECT COALESCE(SUM(p.amount), 0)::text AS total
         FROM payments p
         WHERE p.company_id = $1
           AND p.status = 'succeeded'
           AND p.paid_at >= $2 AND p.paid_at < $3`,
        [company.id, periodStart, periodEnd]
      );
      const recoveredAmountUsd = Number(recoveredRes.rows[0]?.total || 0);

      // Map billing tier to base fee
      const baseFeeMap: Record<number, number> = { 1: 2500, 2: 5000, 3: 10000, 4: 15000 };
      const baseFeeUsd = baseFeeMap[company.billing_tier] ?? 2500;
      const recoveryPercentage = Number(company.recovery_percentage || 1.2);

      const invoice = await generateMonthlyInvoice({
        companyId: company.id,
        customerName: company.name,
        customerEmail: company.email,
        baseFeeUsd,
        recoveredAmountUsd,
        recoveryPercentage,
        periodStart,
        periodEnd,
      });

      results.push({
        companyId: company.id,
        companyName: company.name,
        invoiceNumber: invoice.invoiceNumber,
        totalUsd: invoice.totalUsd,
        paymentLinkUrl: invoice.paymentLinkUrl,
        status: 'generated',
      });

      logInfo(MODULE, fn, 'Invoice generated for company', {
        companyId: company.id,
        invoiceNumber: invoice.invoiceNumber,
        totalUsd: invoice.totalUsd,
      });
    } catch (err) {
      logError(MODULE, fn, 'Failed to generate invoice for company', err, { companyId: company.id });
      results.push({
        companyId: company.id,
        companyName: company.name,
        invoiceNumber: '',
        totalUsd: 0,
        paymentLinkUrl: '',
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logInfo(MODULE, fn, 'Bulk invoice run complete', {
    total: results.length,
    generated: results.filter((r) => r.status === 'generated').length,
    errors: results.filter((r) => r.status === 'error').length,
  });

  return results;
}

// ============ Stripe Connect ============
export interface ConnectStripeInput {
  stripe_api_key: string;
  stripe_webhook_secret?: string;  // Optional: webhook signing secret (recommended)
}

// ============ Invoice Sync ============
export interface SkippedInvoiceDetail {
  stripeInvoiceId: string;
  customerName?: string;
  amount?: number;
  reason: 'NO_EMAIL' | 'ZERO_AMOUNT';
}

export interface SyncInvoicesResult {
  created: number;
  updated: number;
  skipped: number;
  skippedDetails: SkippedInvoiceDetail[];
}

// ============ Stripe Invoice (from Stripe API) ============
export interface StripeInvoice {
  id: string;
  customer: string;
  customer_email: string;
  customer_name: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  due_date: number | null;
  created: number;
  status: string;
}

// ============ Stripe Customer (from Stripe API) ============
export interface StripeCustomer {
  id: string;
  email: string;
  name: string | null;
}

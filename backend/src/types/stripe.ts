// ============ Stripe Connect ============
export interface ConnectStripeInput {
  stripeApiKey: string;
}

// ============ Invoice Sync ============
export interface SyncInvoicesResult {
  created: number;
  updated: number;
  skipped: number;
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

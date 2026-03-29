// ============ Users ============
export interface UserRow {
  id: string;
  company_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  email_verified: boolean;
  otp_code: string | null;
  otp_expires: string | null;
}

export interface UserWithCompany extends UserRow {
  company_name: string;
  timezone: string;
  preferred_currency: string;
}

// ============ Companies ============
export interface CompanyRow {
  id: string;
  name: string;
  email: string;
  owner_id: string | null;
  timezone: string;
  preferred_currency: string;
  dunning_strategy: any;
  stripe_api_key_encrypted: string | null;
  stripe_account_id: string | null;
  slack_webhook_url_encrypted: string | null;
  created_at: string;
  updated_at: string;
  quickbooks_realm_id: string | null;
  quickbooks_access_token_encrypted: string | null;
  quickbooks_refresh_token_encrypted: string | null;
  chargebee_site: string | null;
  chargebee_api_key_encrypted: string | null;
  razorpay_customer_id: string | null;
  razorpay_subscription_id: string | null;
  billing_tier: number | null;
  recovery_percentage: string | null;
  // P0: Pilot mode & reply-to for audit → pilot flow
  pilot_mode: 'shadow' | 'auto' | 'paused' | null;
  reply_to_email: string | null;
  // P0: Manual mode - when true, all emails queued for approval
  manual_mode: boolean | null;
  // CashOS: Onboarding flow stage tracking
  onboarding_stage: 'pending' | 'details_form' | 'create_account' | 'integrations' | 'audit_report' | 'trial_offer' | 'trial_active' | 'paid_active';
  // Trial tracking
  trial_status: 'not_started' | 'active' | 'expired' | 'converted_to_paid' | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
}

// ============ Customers ============
export interface CustomerRow {
  id: string;
  company_id: string;
  name: string;
  email: string;
  company_name: string | null;
  phone: string | null;
  payment_history: any;
  industry: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Phase 3: Behavioral segmentation
  risk_tier: number | null;
  risk_tier_updated_at: string | null;
}

// ============ Invoices ============
export interface InvoiceRow {
  id: string;
  company_id: string;
  customer_id: string;
  amount: string;
  currency: string;
  due_date: string;
  issued_date: string;
  status: 'unpaid' | 'paid' | 'arranged' | 'disputed' | 'uncollectable';
  risk_score: number;
  source: string;
  source_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Dunning control fields
  dunning_paused_until: string | null;
  dunning_stopped: boolean;
  // Phase 1: Decline code intelligence
  decline_code: string | null;
  last_decline_type: 'soft' | 'hard' | 'fraud' | null;
  decline_confidence: number | null;
  // P1: Attribution tracking (was this recovered by RecoverAI dunning?)
  recovered_by_recoverai: boolean;
  recovered_at: string | null;
  recovered_amount: string | null;  // DECIMAL returns as string from pg
  // Fields added by JOIN queries in invoices.ts
  customer_name?: string;
  customer_email?: string;
  // Fields added by agentLoop aggregation
  email_types_sent?: string[];
  dunning_emails_sent?: number;
  // Fields added by listInvoices JOIN queries
  last_payment_date?: string | null;
}

// ============ Payments ============
export interface PaymentRow {
  id: string;
  invoice_id: string;
  company_id: string;
  amount: string;
  currency: string;
  payment_method: string;
  paid_at: string;
  stripe_charge_id: string | null;
  status: 'pending' | 'succeeded' | 'failed';
  notes: string | null;
  created_at: string;
}

// ============ Payment Plans ============
export interface PaymentPlanRow {
  id: string;
  invoice_id: string;
  status: 'active' | 'completed' | 'defaulted';
  installments: any[];
  total_amount: string;
  created_at: string;
  updated_at: string;
}

// ============ Email Logs ============
export interface EmailLogRow {
  id: string;
  invoice_id: string;
  company_id: string;
  email_type: string;
  recipient_email: string;
  subject: string;
  body: string;
  sent_at: string;
  opened_at: string | null;
  clicked_at: string | null;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  sendgrid_message_id: string | null;
}

// ============ Audit Logs ============
export interface AuditLogRow {
  id: string;
  company_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: any | null;
  changes: any | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============ Exchange Rates ============
export interface ExchangeRateRow {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: string;
  updated_at: string;
}

// ============ API Usage Tracking ============
export interface ApiUsageRow {
  id: string;
  company_id: string | null;
  service: string;
  usage_count: number;
  cost_usd: string;
  period: string;
  created_at: string;
}

// ============ Integration Logs ============
export interface IntegrationLogRow {
  id: string;
  company_id: string;
  integration: string;
  action: string;
  status: 'success' | 'error';
  records_count: number;
  error_message: string | null;
  created_at: string;
}

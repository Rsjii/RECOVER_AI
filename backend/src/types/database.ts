// ============ Users ============
export interface UserRow {
  id: string;
  company_id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  is_demo: boolean;                // true = demo account (read-only, all mutations blocked)
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
  stripe_webhook_secret_encrypted: string | null;
  stripe_last_synced_at: string | null;
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
  // SMTP Configuration
  smtp_enabled: boolean | null;
  smtp_fallback_to_resend: boolean | null;
  // CashOS: Onboarding flow stage tracking
  onboarding_stage: 'pending' | 'details_form' | 'create_account' | 'integrations' | 'audit_report' | 'trial_offer' | 'trial_active' | 'paid_active';
  // Trial tracking
  trial_status: 'not_started' | 'active' | 'expired' | 'converted_to_paid' | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  // Phase 2: Dunning strategy controls (via Slack bot)
  dunning_tone: 'gentle' | 'standard' | 'aggressive' | null;
  pause_dunning_until: string | null;
  paused_customers: string[] | null;
  aggressive_enabled: boolean | null;
  // Slack bot configuration
  slack_bot_token_encrypted: string | null;
  slack_signing_secret_encrypted: string | null;
  slack_channel_id: string | null;
  slack_notifications_enabled: boolean | null;
  // Dunning email customization
  dunning_sender_name: string | null;
  // SMS Configuration
  sms_enabled: boolean | null;
  sms_tone: string | null;
  sms_escalation_enabled: boolean | null;
  sms_max_per_invoice: number | null;
  // Twilio Configuration
  twilio_account_sid_encrypted: string | null;
  twilio_auth_token_encrypted: string | null;
  twilio_phone_number: string | null;
  twilio_configured: boolean | null;
  // Notification Preferences (P1 - User Customizable Only)
  notify_contact_invalid: boolean | null;          // email hard bounce or SMS hard fail
  notify_payment_received: boolean | null;
  notify_emails_pending: boolean | null;
  // System alerts & trial ending are ALWAYS ON (not customizable)
}

// ============ Customers ============
export interface CustomerRow {
  id: string;
  company_id: string;
  name: string | null;  // Contact person name (OPTIONAL)
  email: string | null;  // NULL allowed for customers without email
  company_name: string;  // Company name (REQUIRED - who owes us money)
  phone: string | null;
  payment_history: any;
  industry: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Phase 3: Behavioral segmentation
  risk_tier: number | null;
  risk_tier_updated_at: string | null;
  // Risk scoring (calculated daily from payment behavior)
  customer_risk_score: number;  // 0-100, calculated from payment history
  customer_risk_score_updated_at: string | null;
  // Payment insights & unpaid invoice count
  unpaid_invoice_count?: number;  // Count of unpaid invoices for this customer
  payment_insights?: any;  // Per-customer behavioral profile
  // Aggregated summaries
  dunning_summary?: any;
  queue_summary?: any;
  last_decline_type?: string | null;
  total_ar_balance?: number | string;
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

// ============ SMS Logs ============
export interface SMSLogRow {
  id: string;
  invoice_id: string;
  company_id: string;
  customer_id: string;
  phone: string;
  content: string;
  twilio_message_sid: string | null;
  sent_at: string;
  delivered_at: string | null;
  failed_at: string | null;
  status: 'sent' | 'delivered' | 'failed' | 'undelivered';
  failure_reason: string | null;
  created_at: string;
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

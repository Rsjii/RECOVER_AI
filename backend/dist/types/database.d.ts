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
}
export interface UserWithCompany extends UserRow {
    company_name: string;
    timezone: string;
    preferred_currency: string;
}
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
}
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
}
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
    customer_name?: string;
    customer_email?: string;
}
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
export interface PaymentPlanRow {
    id: string;
    invoice_id: string;
    status: 'active' | 'completed' | 'defaulted';
    installments: any[];
    total_amount: string;
    created_at: string;
    updated_at: string;
}
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
export interface ExchangeRateRow {
    id: string;
    from_currency: string;
    to_currency: string;
    rate: string;
    updated_at: string;
}
export interface ApiUsageRow {
    id: string;
    company_id: string | null;
    service: string;
    usage_count: number;
    cost_usd: string;
    period: string;
    created_at: string;
}
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

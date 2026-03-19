export type InvoiceStatus = 'unpaid' | 'paid' | 'arranged' | 'disputed' | 'uncollectable';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  email: string;
  company_name?: string;
  phone?: string;
  phone_opt_in?: boolean;
  industry?: string;
  payment_history: {
    on_time_rate: number;
    avg_days_late: number;
    total_invoices: number;
  };
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  customer_id: string;
  amount: number;
  currency: string;
  due_date: string;
  issued_date: string;
  status: InvoiceStatus;
  risk_score: number;
  source: 'stripe' | 'quickbooks' | 'chargebee' | 'manual';
  source_id?: string;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  customer_email?: string;
  days_overdue?: number;
  dunning_paused_until?: string | null;
  dunning_stopped?: boolean;
}

export interface DunningStatus {
  nextEmailType: string | null;
  nextScheduledDate: string | null;
  isPaused: boolean;
  pausedUntil: string | null;
  isStopped: boolean;
  history: EmailLog[];
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: 'stripe' | 'ach' | 'wire' | 'check' | 'manual';
  paid_at: string;
  stripe_charge_id?: string;
  status: 'pending' | 'succeeded' | 'failed';
  created_at: string;
}

export interface EmailLog {
  id: string;
  invoice_id: string;
  email_type: string;
  recipient_email: string;
  subject: string;
  body: string;
  sent_at: string;
  opened_at?: string;
  clicked_at?: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  sendgrid_message_id?: string;
}

export interface PaymentPlan {
  id: string;
  invoice_id: string;
  status: 'active' | 'completed' | 'defaulted';
  installments: {
    amount: number;
    due_date: string;
    paid: boolean;
  }[];
  created_at: string;
  updated_at: string;
}

// ── Dashboard types (match backend db/dashboard.ts exactly) ──────────────

export interface DashboardStats {
  totalInvoices: number;
  totalOwed: number;
  totalRecovered: number;
  recoveryRate: number;
  avgDaysToCollect: number;
  overdueCount: number;
  overdueAmount: number;
}

export interface InvoicePipeline {
  unpaid: number;
  paid: number;
  arranged: number;
  disputed: number;
  uncollectable: number;
  unpaidAmount: number;
  arrangedAmount: number;
}

export interface CustomerRisk {
  customerId: string;
  customerName: string;
  customerEmail: string;
  unpaidInvoices: number;
  totalOwed: number;
  maxRiskScore: number;
  oldestDueDays: number;
}

// ── Invoice detail composite response ────────────────────────────────────

export interface InvoiceDetail {
  invoice: Invoice;
  payments: Payment[];
  emailLogs: EmailLog[];
  paymentPlan: PaymentPlan | null;
}

// ── Settings types (match backend settingsController) ────────────────────

export interface DunningStrategy {
  num_emails: number;
  days_between: number;
  approval_required: boolean;
}

export interface CompanySettings {
  companyId: string;
  companyName: string;
  timezone: string;
  preferredCurrency: string;
  dunningStrategy: DunningStrategy;
  integrations: {
    stripe: boolean;
    slack: boolean;
  };
}

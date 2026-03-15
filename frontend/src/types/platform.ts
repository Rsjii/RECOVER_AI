export interface SubscriptionPlan {
  id: string;
  code: string;
  name: string;
  base_price_usd: string;
  success_fee_percent: string;
  billing_interval: 'monthly' | 'annual';
  features: Record<string, unknown>;
  limits: Record<string, unknown>;
  is_active: boolean;
}

export interface CompanySubscription {
  id: string;
  company_id: string;
  plan_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  plan_code: string;
  plan_name: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
}

export interface BillingInvoice {
  id: string;
  period_start: string;
  period_end: string;
  base_amount_usd: string;
  success_fee_amount_usd: string;
  total_amount_usd: string;
  status: string;
  due_at?: string;
  paid_at?: string;
  created_at: string;
}

export interface UsageRollup {
  metric_key: string;
  quantity: string;
  period_month: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  token: string;
  expires_at: string;
  accepted_at?: string;
  created_at: string;
}

export interface ComplianceRequest {
  id: string;
  request_type: 'export' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requested_at: string;
  completed_at?: string;
  payload: Record<string, unknown>;
}

export interface AgentPolicy {
  autonomyLevel: 'autonomous' | 'assisted' | 'manual';
  maxEmailsPerWeek: number;
  requireApprovalForHighRisk: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  escalationDays: number;
}



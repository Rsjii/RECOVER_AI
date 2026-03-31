export interface User {
  id: string;
  email: string;
  company_id: string;
  role?: 'admin' | 'owner' | 'user';
  created_at: string;
  updated_at: string;
  last_login?: string;
  emailVerified?: boolean;
  onboardingStatus?: 'onboarding' | 'company_form' | 'stripe_pending' | 'active';
  authProvider?: 'email' | 'google' | 'both';
}

export interface Company {
  id: string;
  name: string;
  email: string;
  owner_id: string;
  timezone: string;
  preferred_currency: string;
  stripe_account_id?: string;
  quickbooks_realm_id?: string;
  chargebee_site?: string;
  created_at: string;
  updated_at: string;
  // Flow enforcement fields
  accountType?: 'pilot' | 'paid';
  pilotMode?: 'shadow' | 'auto' | 'paused' | null;
  pilotEndsAt?: string | null;
  stripeConnected?: boolean;
  // CashOS: Onboarding stage tracking
  onboarding_stage?: 'pending' | 'details_form' | 'create_account' | 'integrations' | 'audit_report' | 'trial_offer' | 'trial_active' | 'paid_active';
  // Trial tracking
  trial_status?: 'not_started' | 'active' | 'expired' | 'converted_to_paid' | null;
  trial_starts_at?: string | null;
  trial_ends_at?: string | null;
}

export interface AuthState {
  user: User | null;
  company: Company | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  company_name: string;
}

export interface AuthResponse {
  user: User;
  company: Company;
  token: string;
}

export interface MeResponse {
  user: User;
  company: Company;
}

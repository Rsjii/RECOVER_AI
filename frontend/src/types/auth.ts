export interface User {
  id: string;
  email: string;
  company_id: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
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

// ============ JWT & Auth Tokens ============
export interface JWTPayload {
  userId: string;
  companyId: string;
  email: string;
  is_demo?: boolean;  // true = demo account (read-only, all mutations blocked)
}

// ============ Auth Requests ============
export interface SignupInput {
  companyName: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  timezone?: string;
  preferredCurrency?: string;
  planCode?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ============ Auth Responses ============
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified?: boolean;
  onboardingStatus?: string;
}

export interface AuthCompany {
  id: string;
  name: string;
  timezone: string;
  preferredCurrency: string;
  accountType: 'pilot' | 'paid';
  pilotMode: 'shadow' | 'auto' | 'paused' | null;
  pilotEndsAt: string | null;
  stripeConnected: boolean;
  onboarding_stage: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  company: AuthCompany;
  tokens: AuthTokens;
}

export interface GoogleOAuthInput {
  code: string;
}

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface GoogleTokenResponse {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  at_hash: string;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  locale: string;
  iat: number;
  exp: number;
}

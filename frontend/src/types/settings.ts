/**
 * Settings Form Data Types
 * Used across all Settings sub-tabs
 */

export interface ProfileFormData {
  companyName: string;
  email: string;
  timezone: string;
  logoUrl?: string;
}

export interface EmailSettingsFormData {
  senderEmail: string;
  emailTone: 'friendly' | 'professional' | 'aggressive';
  customSignature: string;
}

export interface DunningPaymentPlansFormData {
  email1Day: number;
  email2Day: number;
  email3Day: number;
  email4Day: number;
  email5Day: number;
  autoPauseOnReply: boolean;
  lowRiskSplit: string;   // "50/50", "40/60", etc
  medRiskSplit: string;
  highRiskSplit: string;
}

export interface AutomationFormData {
  pilotMode: string;  // 'auto' | 'shadow' | 'paused'
}

export interface SettingsFormData {
  profile: ProfileFormData;
  email: EmailSettingsFormData;
  dunning: DunningPaymentPlansFormData;
  automation: AutomationFormData;
}

export interface IntegrationStatus {
  type: 'stripe' | 'csv' | 'slack' | 'quickbooks' | 'xero' | 'plaid';
  status: 'connected' | 'not_connected' | 'error' | 'coming_soon';
  details?: {
    accountName?: string;
    email?: string;
    workspaceName?: string;
    channel?: string;
  };
  lastSynced?: string;
  errorMessage?: string;
  availableIn?: string; // "GROWTH_TIER"
  hasWebhookSecret?: boolean; // For Stripe: whether webhook signing secret is configured
}

export interface SessionInfo {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
  lastActive?: string;
  isCurrent?: boolean;
}

export interface SettingsState {
  formData: SettingsFormData;
  integrations: IntegrationStatus[];
  sessions: SessionInfo[];
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

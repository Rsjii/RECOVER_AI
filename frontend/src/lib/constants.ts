export const API_ENDPOINTS = {
  auth: {
    signup: '/api/auth/signup',
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    refresh: '/api/auth/refresh',
    me: '/api/auth/me',
    forgotPassword: '/api/auth/forgot-password',
    resetPassword: '/api/auth/reset-password',
    sessions: '/api/auth/sessions',
    companySessions: '/api/auth/sessions/company',
    revokeSession: (sessionId: string) => `/api/auth/sessions/${sessionId}`,
    revokeCompanySession: (sessionId: string) => `/api/auth/sessions/company/${sessionId}`,
    revokeAllSessions: '/api/auth/sessions/revoke-all',
  },
  stripe: {
    connect: '/api/stripe/connect',
    sync: '/api/stripe/sync',
    syncHistory: '/api/stripe/sync/history',
    invoices: '/api/stripe/invoices',
    invoiceDetail: (id: string) => `/api/stripe/invoices/${id}`,
  },
  quickbooks: {
    authorize: '/api/quickbooks/oauth/authorize',
    sync: '/api/quickbooks/sync',
    disconnect: '/api/quickbooks/disconnect',
  },
  chargebee: {
    connect: '/api/chargebee/connect',
    sync: '/api/chargebee/sync',
    disconnect: '/api/chargebee/disconnect',
    webhook: '/api/chargebee/webhook',
  },
  invoices: {
    list: '/api/invoices',
    detail: (id: string) => `/api/invoices/${id}`,
    detailFull: (id: string) => `/api/invoices/${id}/detail`,
    manual: '/api/invoices/manual',
    status: (id: string) => `/api/invoices/${id}/status`,
    csvUpload: '/api/invoices/csv-upload',
  },
  customers: {
    list: '/api/customers',
    detail: (id: string) => `/api/customers/${id}`,
  },
  dashboard: {
    stats: '/api/dashboard/stats',
    pipeline: '/api/dashboard/pipeline',
    riskList: '/api/dashboard/risk-list',
    timeline: '/api/dashboard/timeline',
  },
  email: {
    schedule: '/api/email/schedule',
    sendNow: '/api/email/send-now',
    logs: '/api/email/logs',
    stats: '/api/email/queue/stats',
    preview: (invoiceId: string, emailType = 'dunning_1') =>
      `/api/email/preview?invoiceId=${invoiceId}&emailType=${emailType}`,
  },
  paymentPlans: {
    create: '/api/payment-plans',
    byInvoice: (invoiceId: string) => `/api/payment-plans?invoiceId=${invoiceId}`,
    list: '/api/payment-plans/list',
    status: (planId: string) => `/api/payment-plans/${planId}/status`,
  },
  settings: {
    get: '/api/settings',
    dunning: '/api/settings/dunning',
    slack: '/api/settings/slack',
    general: '/api/settings/general',
  },
  billing: {
    plans: '/api/billing/plans',
    subscription: '/api/billing/subscription',
    invoices: '/api/billing/invoices',
    generateInvoice: '/api/billing/invoices/generate',
    usage: '/api/billing/usage',
    syncRecovered: '/api/billing/usage/sync-recovered',
    reconcileUsage: '/api/billing/usage/reconcile',
    entitlements: '/api/billing/entitlements',
    checkout: '/api/billing/checkout',
    razorpayGenerateInvoices: '/api/billing/razorpay/generate-invoices',
    razorpayGenerateInvoice: (companyId: string) => `/api/billing/razorpay/generate-invoice/${companyId}`,
    razorpaySetTier: (companyId: string) => `/api/billing/razorpay/company/${companyId}/tier`,
  },
  team: {
    members: '/api/team/members',
    invite: '/api/team/invite',
    updateRole: (userId: string) => `/api/team/members/${userId}/role`,
    revoke: (userId: string) => `/api/team/members/${userId}`,
    invitationValidate: '/api/team/invitation/validate',
    invitationAccept: '/api/team/invitation/accept',
  },
  compliance: {
    requests: '/api/compliance/requests',
    export: '/api/compliance/export',
    delete: '/api/compliance/delete',
  },
  policy: {
    get: '/api/policy',
    update: '/api/policy',
    simulate: '/api/policy/simulate',
    approvals: '/api/policy/approvals',
    approvalDecision: (approvalId: string) => `/api/policy/approvals/${approvalId}/decision`,
  },
  entitlements: {
    get: '/api/entitlements',
  },
  featureFlags: {
    list: '/api/feature-flags',
    update: '/api/feature-flags',
  },
};

export const RISK_COLORS = {
  low: '#16a34a',
  medium: '#ca8a04',
  high: '#ea580c',
  critical: '#dc2626',
};

export const RISK_LEVELS = {
  low: { min: 0, max: 29, label: 'Low', color: RISK_COLORS.low },
  medium: { min: 30, max: 59, label: 'Medium', color: RISK_COLORS.medium },
  high: { min: 60, max: 89, label: 'High', color: RISK_COLORS.high },
  critical: { min: 90, max: 100, label: 'Critical', color: RISK_COLORS.critical },
};

export const STATUS_COLORS = {
  unpaid: '#ef4444',
  paid: '#10b981',
  arranged: '#3b82f6',
  disputed: '#f59e0b',
  uncollectable: '#6b7280',
};

export const DATE_FORMAT = 'MMM dd, yyyy';
export const DATE_TIME_FORMAT = 'MMM dd, yyyy hh:mm a';

export const PAGINATION_LIMIT = 20;

export const API_TIMEOUT = 30000;

export const APP_NAME = 'RecoverAI';

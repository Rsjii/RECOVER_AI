// ============ Risk Score Input/Output ============
export interface RiskScoreInput {
  customerId: string;
  invoiceId?: string;
  includeHistory?: boolean;
}

export interface CustomerPaymentHistory {
  totalInvoices: number;
  totalPaid: number;
  totalOutstanding: number;
  onTimePayments: number;
  latePayments: number;
  averageDaysLate: number;
  onTimeRate: number;
  lastPaymentDate?: string;
  avgPaymentDays?: number;
}

export interface RiskScoreResponse {
  customerId: string;
  riskScore: number;  // 0-100: 0=lowest risk, 100=highest risk
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasoning: string;
  paymentHistory: CustomerPaymentHistory;
  recommendations: string[];
  confidenceScore: number;  // 0-100
}

// ============ Email Generation Input/Output ============
export interface DunningEmailGenerationInput {
  customerId: string;
  invoiceId: string;
  customerName: string;
  invoiceAmount: number;
  dueDate: string;
  daysOverdue: number;
  riskScore?: number;
  previousReminders?: number;
  emailType?: string;  // dunning_1, dunning_2, ..., payment_plan_offer
  companyName: string;
  paymentLink?: string;
}

export interface DunningEmailResponse {
  subject: string;
  bodyText: string;
  bodyHtml: string;
  tone: 'friendly' | 'firm' | 'urgent';
  estimatedOpenRate?: number;
  personalizedElements: string[];
}

// ============ Payment Plan Input/Output ============
export interface PaymentPlanRecommendationInput {
  customerId: string;
  invoiceId: string;
  invoiceAmount: number;
  daysOverdue: number;
  riskScore?: number;
  customerPaymentHistory?: CustomerPaymentHistory;
  maxDurationDays?: number;  // default: 90
}

export interface PaymentPlanTerms {
  installmentCount: number;
  installmentAmount: number;
  firstPaymentDate: string;
  frequencyDays: number;  // gap between payments
  downPaymentPercentage: number;  // % of total as down payment
}

export interface PaymentPlanRecommendationResponse {
  customerId: string;
  invoiceId: string;
  recommendedPlan: PaymentPlanTerms;
  alternativePlans: PaymentPlanTerms[];
  reasoning: string;
  successProbability: number;  // 0-100
  riskAssessment: string;
}

// ============ Anthropic API Response Types ============
export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicMessageResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicTextBlock[];
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ============ AI Service Context ============
export interface AIServiceContext {
  companyId: string;
  userId: string;
}

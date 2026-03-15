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
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reasoning: string;
    paymentHistory: CustomerPaymentHistory;
    recommendations: string[];
    confidenceScore: number;
}
export interface DunningEmailGenerationInput {
    customerId: string;
    invoiceId: string;
    customerName: string;
    invoiceAmount: number;
    dueDate: string;
    daysOverdue: number;
    riskScore?: number;
    previousReminders?: number;
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
export interface PaymentPlanRecommendationInput {
    customerId: string;
    invoiceId: string;
    invoiceAmount: number;
    daysOverdue: number;
    riskScore?: number;
    customerPaymentHistory?: CustomerPaymentHistory;
    maxDurationDays?: number;
}
export interface PaymentPlanTerms {
    installmentCount: number;
    installmentAmount: number;
    firstPaymentDate: string;
    frequencyDays: number;
    downPaymentPercentage: number;
}
export interface PaymentPlanRecommendationResponse {
    customerId: string;
    invoiceId: string;
    recommendedPlan: PaymentPlanTerms;
    alternativePlans: PaymentPlanTerms[];
    reasoning: string;
    successProbability: number;
    riskAssessment: string;
}
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
export interface AIServiceContext {
    companyId: string;
    userId: string;
}

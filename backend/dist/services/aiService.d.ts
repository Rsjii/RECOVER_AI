import { RiskScoreInput, RiskScoreResponse, DunningEmailGenerationInput, DunningEmailResponse, PaymentPlanRecommendationInput, PaymentPlanRecommendationResponse } from '../types/ai';
declare class AIService {
    /**
     * Detect which AI provider to use based on available API keys.
     * Priority: Anthropic (if valid key) → OpenAI (explicit or fallback) → Error
     */
    private getProviderSelection;
    /**
     * Extract and parse JSON object from AI model text response.
     * Handles markdown code fences, extra whitespace, etc.
     */
    private parseJsonFromModelResponse;
    /**
     * Send prompt to AI provider and return parsed JSON.
     * Handles Anthropic Messages API and OpenAI Chat Completions API.
     */
    private generateJsonResponse;
    /**
     * Fetch customer payment history from database.
     * JOINs payments → invoices (payments table has no customer_id column).
     * Computes days_late and days_to_pay from timestamps.
     */
    private getCustomerPaymentHistory;
    /**
     * Calculate risk score for a customer using AI analysis of payment history.
     */
    calculateRiskScore(input: RiskScoreInput): Promise<RiskScoreResponse>;
    /**
     * Generate a personalized dunning email using AI.
     * Tone is auto-selected based on daysOverdue.
     */
    generateDunningEmail(input: DunningEmailGenerationInput): Promise<DunningEmailResponse>;
    /**
     * Recommend payment plan terms using AI.
     * Fetches customer history from DB if not provided.
     */
    recommendPaymentPlan(input: PaymentPlanRecommendationInput): Promise<PaymentPlanRecommendationResponse>;
}
declare const _default: AIService;
export default _default;

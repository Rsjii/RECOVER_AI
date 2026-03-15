export interface PlanRow {
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
export interface SubscriptionRow {
    id: string;
    company_id: string;
    plan_id: string;
    status: 'trialing' | 'active' | 'past_due' | 'canceled';
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
}
export declare function ensureDefaultPlans(): Promise<void>;
export declare function listActivePlans(): Promise<PlanRow[]>;
export declare function getCurrentSubscription(companyId: string): Promise<(SubscriptionRow & {
    plan_code: string;
    plan_name: string;
}) | null>;
export declare function upsertCompanySubscription(input: {
    companyId: string;
    planCode: string;
    status: SubscriptionRow['status'];
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    trialEndsAt?: Date | null;
}): Promise<void>;
export declare function createBillingInvoice(input: {
    companyId: string;
    subscriptionId: string | null;
    periodStart: Date;
    periodEnd: Date;
    baseAmountUsd: number;
    successFeeAmountUsd: number;
    totalAmountUsd: number;
    lineItems: Array<Record<string, unknown>>;
    status?: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
}): Promise<void>;
export declare function listBillingInvoices(companyId: string, limit?: number): Promise<any[]>;
export declare function recordUsageEvent(input: {
    companyId: string;
    metricKey: string;
    quantity: number;
    source?: string;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
}): Promise<void>;
export declare function getUsageRollups(companyId: string, periodMonth?: Date): Promise<any[]>;
export declare function getEntitlements(companyId: string): Promise<{
    planCode: string;
    features: Record<string, unknown>;
    limits: Record<string, unknown>;
} | null>;

export interface ConnectStripeInput {
    stripeApiKey: string;
}
export interface SyncInvoicesResult {
    created: number;
    updated: number;
    skipped: number;
}
export interface StripeInvoice {
    id: string;
    customer: string;
    customer_email: string;
    customer_name: string;
    amount_due: number;
    amount_paid: number;
    currency: string;
    due_date: number | null;
    created: number;
    status: string;
}
export interface StripeCustomer {
    id: string;
    email: string;
    name: string | null;
}

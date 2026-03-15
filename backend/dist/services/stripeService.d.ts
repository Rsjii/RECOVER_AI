import { ConnectStripeInput, SyncInvoicesResult } from '../types/stripe';
declare class StripeService {
    connectStripe(companyId: string, userId: string, input: ConnectStripeInput): Promise<void>;
    syncInvoices(companyId: string): Promise<SyncInvoicesResult>;
    handleWebhook(rawBody: Buffer, signature: string): Promise<void>;
    private handleInvoicePaid;
    private handleDirectCharge;
    getAccessToken(code: string): Promise<{
        access_token: string;
        stripe_user_id: string;
        error?: string;
    }>;
    connectViaOAuth(companyId: string, userId: string, code: string): Promise<void>;
}
export declare const stripeService: StripeService;
export {};

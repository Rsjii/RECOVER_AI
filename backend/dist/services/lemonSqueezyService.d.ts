export declare class LemonSqueezyService {
    private apiKey;
    private storeId;
    private webhookSecret;
    createCheckout(params: {
        planId: 'starter' | 'growth' | 'enterprise';
        customerEmail: string;
        customerName: string;
        companyId: string;
    }): Promise<{
        success: boolean;
        checkoutUrl?: string;
        error?: string;
    }>;
    verifyWebhookSignature(body: string, signature: string): boolean;
    handleWebhook(event: any): Promise<void>;
}
declare const _default: LemonSqueezyService;
export default _default;

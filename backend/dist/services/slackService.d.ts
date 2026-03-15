/**
 * Send a payment received alert to Slack
 */
export declare function sendPaymentAlert(params: {
    customerName: string;
    amount: number;
    currency: string;
    invoiceId: string;
    webhookUrl?: string;
}): Promise<void>;
/**
 * Send daily recovery digest
 */
export declare function sendDailyDigest(params: {
    totalOwed: number;
    totalRecovered: number;
    recoveryRate: number;
    overdueCount: number;
    emailsSentToday: number;
    currency?: string;
    webhookUrl?: string;
}): Promise<void>;

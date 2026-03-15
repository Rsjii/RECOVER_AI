export interface DunningEmailJob {
    companyId: string;
    customerId: string;
    invoiceId: string;
    recipientEmail: string;
    customerName: string;
    invoiceAmount: number;
    dueDate: string;
    daysOverdue: number;
    emailType: DunningEmailType;
    attemptNumber: number;
    paymentLink?: string;
    riskScore?: number;
}
export type DunningEmailType = 'dunning_1' | 'dunning_2' | 'dunning_3' | 'dunning_4' | 'dunning_5' | 'payment_plan_offer';
export type EmailStatus = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
export interface SendGridWebhookEvent {
    email: string;
    timestamp: number;
    event: string;
    sg_message_id?: string;
    url?: string;
}
export interface ScheduleEmailInput {
    invoiceId: string;
    delayMs?: number;
}
export interface SendEmailInput {
    invoiceId: string;
    emailType?: DunningEmailType;
}

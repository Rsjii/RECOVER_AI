import { DunningEmailType, EmailStatus } from '../types/email';
export interface CreateEmailLogInput {
    id?: string;
    invoiceId: string;
    companyId: string;
    emailType: DunningEmailType;
    recipientEmail: string;
    subject: string;
    body: string;
    sendgridMessageId?: string;
}
export declare function createEmailLog(input: CreateEmailLogInput): Promise<string>;
export declare function markEmailOpened(logId: string): Promise<void>;
export declare function markEmailClicked(logId: string): Promise<void>;
export declare function updateEmailStatus(sendgridMessageId: string, status: EmailStatus, field?: 'opened_at' | 'clicked_at'): Promise<void>;
export declare function countEmailsSentForInvoice(invoiceId: string): Promise<number>;
export declare function listEmailLogs(companyId: string, invoiceId?: string): Promise<any[]>;

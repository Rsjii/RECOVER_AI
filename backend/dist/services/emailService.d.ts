import { DunningEmailJob } from '../types/email';
export interface SendResult {
    success: boolean;
    sendgridMessageId?: string;
    emailLogId?: string;
    error?: string;
}
declare class EmailService {
    /**
     * Send a dunning email via SendGrid.
     * Uses AI to generate personalized subject + body.
     * Logs to email_logs table on success.
     */
    sendDunningEmail(job: DunningEmailJob): Promise<SendResult>;
}
declare const _default: EmailService;
export default _default;

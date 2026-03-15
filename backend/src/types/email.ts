// ============ Email Job (sent to BullMQ queue) ============
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
  attemptNumber: number;       // 1–5
  paymentLink?: string;
  riskScore?: number;
}

export type DunningEmailType =
  | 'dunning_1'
  | 'dunning_2'
  | 'dunning_3'
  | 'dunning_4'
  | 'dunning_5'
  | 'payment_plan_offer';

export type EmailStatus = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';

// ============ SendGrid Webhook Event ============
export interface SendGridWebhookEvent {
  email: string;
  timestamp: number;
  event: string;   // delivered, open, click, bounce, etc.
  sg_message_id?: string;
  url?: string;    // for click events
}

// ============ Schedule Email Request ============
export interface ScheduleEmailInput {
  invoiceId: string;
  delayMs?: number;
}

// ============ Manual Send Request ============
export interface SendEmailInput {
  invoiceId: string;
  emailType?: DunningEmailType;
}

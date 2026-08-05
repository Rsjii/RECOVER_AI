import { EmailLogRow, SMSLogRow, PaymentRow } from '../types/database';

export interface TimelineEvent {
  type: 'email' | 'sms' | 'payment' | 'scheduled';
  timestamp: string;
  status: string;
  email_type?: string;
  subject?: string;
  message?: string;
  phone?: string;
  amount?: string;
  payment_method?: string;
  action?: string;
}

export function mergeTimelineEvents(
  emailLogs: EmailLogRow[],
  smsLogs: SMSLogRow[],
  payments: PaymentRow[],
  dunningStatus: any
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (emailLogs && Array.isArray(emailLogs)) {
    emailLogs.forEach((e) => {
      events.push({
        type: 'email',
        timestamp: e.sent_at,
        status: e.status,
        email_type: e.email_type,
        subject: e.subject,
      });
    });
  }

  if (smsLogs && Array.isArray(smsLogs)) {
    smsLogs.forEach((s) => {
      events.push({
        type: 'sms',
        timestamp: s.sent_at,
        status: s.status,
        message: s.content,
        phone: s.phone,
      });
    });
  }

  if (payments && Array.isArray(payments)) {
    payments.forEach((p) => {
      events.push({
        type: 'payment',
        timestamp: p.paid_at,
        status: 'completed',
        amount: p.amount,
        payment_method: p.payment_method,
      });
    });
  }

  if (dunningStatus?.nextScheduledDate && dunningStatus?.nextEmailType) {
    events.push({
      type: 'scheduled',
      timestamp: dunningStatus.nextScheduledDate,
      status: 'pending',
      action: dunningStatus.nextEmailType,
    });
  }

  return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

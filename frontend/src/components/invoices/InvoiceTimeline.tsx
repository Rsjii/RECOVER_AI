import React from 'react';
import { Card } from '../ui/Card';
import { TimelineEvent } from './TimelineEvent';

interface TimelineEventData {
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

interface Props {
  events: TimelineEventData[];
}

export const InvoiceTimeline: React.FC<Props> = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📊 Recovery Journey</h3>
        <p className="text-gray-600 dark:text-gray-400">No recovery attempts yet</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">📊 Recovery Journey</h3>
      <div className="space-y-2">
        {events.map((event, idx) => (
          <TimelineEvent key={idx} {...event} />
        ))}
      </div>
    </Card>
  );
};

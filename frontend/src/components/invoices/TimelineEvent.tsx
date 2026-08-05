import React from 'react';
import { formatDate } from '../../lib/utils';

interface TimelineEventProps {
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

export const TimelineEvent: React.FC<TimelineEventProps> = (props) => {
  const getIcon = () => {
    const icons: { [key: string]: string } = {
      email: '📧',
      sms: '📱',
      payment: '💰',
      scheduled: '⏰',
    };
    return <span className="text-2xl">{icons[props.type] || '⏰'}</span>;
  };

  const getStatusBadge = () => {
    const statusMap: { [key: string]: { bg: string; text: string; icon: string } } = {
      sent: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', icon: '✓' },
      delivered: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', icon: '✓' },
      opened: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', icon: '✓' },
      bounced: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200', icon: '⚠' },
      failed: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200', icon: '⚠' },
      pending: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200', icon: '⏳' },
      completed: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', icon: '✓' },
    };
    const config = statusMap[props.status.toLowerCase()] || statusMap.pending;
    return <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${config.bg} ${config.text}`}>{config.icon} {props.status}</div>;
  };

  return (
    <div className="flex gap-4 pb-6">
      <div className="flex flex-col items-center">
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full">{getIcon()}</div>
        <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 mt-2" />
      </div>

      <div className="flex-1 pb-2">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatDate(props.timestamp)}</p>
          {getStatusBadge()}
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 space-y-1">
          {props.type === 'email' && (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{props.email_type}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{props.subject}</p>
            </>
          )}
          {props.type === 'sms' && (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">SMS to {props.phone}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{props.message}</p>
            </>
          )}
          {props.type === 'payment' && (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Payment Received</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{props.amount} via {props.payment_method}</p>
            </>
          )}
          {props.type === 'scheduled' && (
            <>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Scheduled: {props.action}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Waiting for agent run</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Card } from '../ui/Card';
import { formatDate } from '../../lib/utils';

interface EmailLog {
  id: string;
  email_type: string;
  subject: string;
  status: string;
  sent_at: string;
}

interface SMSLog {
  id: string;
  phone: string;
  content: string;
  status: string;
  sent_at: string;
}

interface Props {
  emailLogs: EmailLog[];
  smsLogs: SMSLog[];
}

export const CommunicationLog: React.FC<Props> = ({ emailLogs, smsLogs }) => {
  const getStatusColor = (status: string) => {
    const map: { [key: string]: string } = {
      sent: 'text-blue-600 dark:text-blue-400',
      delivered: 'text-green-600 dark:text-green-400',
      opened: 'text-blue-600 dark:text-blue-400',
      bounced: 'text-red-600 dark:text-red-400',
      failed: 'text-red-600 dark:text-red-400',
    };
    return map[status.toLowerCase()] || 'text-gray-600 dark:text-gray-400';
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">📧 Full Communication Log</h3>

      <div className="space-y-4">
        {emailLogs && emailLogs.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              📧 Emails ({emailLogs.length})
            </p>
            <div className="space-y-2">
              {emailLogs.map((log) => (
                <div key={log.id} className="p-3 border dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{log.email_type}</p>
                    <span className={`text-xs font-semibold ${getStatusColor(log.status)}`}>{log.status.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{formatDate(new Date(log.sent_at))}</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">{log.subject}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {smsLogs && smsLogs.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              📱 SMS ({smsLogs.length})
            </p>
            <div className="space-y-2">
              {smsLogs.map((log) => (
                <div key={log.id} className="p-3 border dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{log.phone}</p>
                    <span className={`text-xs font-semibold ${getStatusColor(log.status)}`}>{log.status.toUpperCase()}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{formatDate(new Date(log.sent_at))}</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">{log.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!emailLogs || emailLogs.length === 0) && (!smsLogs || smsLogs.length === 0) && (
          <p className="text-gray-600 dark:text-gray-400">No communication attempts yet</p>
        )}
      </div>
    </Card>
  );
};

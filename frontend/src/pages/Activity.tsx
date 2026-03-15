import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { API_ENDPOINTS } from '../lib/constants';
import { formatDate } from '../lib/utils';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';

const Activity: React.FC = () => {
  useEffect(() => { document.title = 'Activity — RecoverAI'; }, []);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueStats, setQueueStats] = useState<any>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [logsRes, statsRes] = await Promise.all([
          api.get<{ data: any[] }>(API_ENDPOINTS.email.logs),
          api.get<{ data: any }>(API_ENDPOINTS.email.stats).catch(() => ({ data: null })),
        ]);
        setLogs(logsRes.data || []);
        setQueueStats(statsRes.data);
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" text="Loading activity..." /></div>;

  const statusIcon = (status: string) => {
    switch (status) {
      case 'opened': case 'clicked': return '✅';
      case 'bounced': case 'failed': return '❌';
      case 'delivered': return '📬';
      default: return '📧';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Activity</h1>
        {queueStats && (
          <div className="flex gap-4 text-sm">
            <span className="text-gray-500">Queue: <span className="font-medium text-gray-900 dark:text-white">{queueStats.waiting || 0} waiting</span></span>
            <span className="text-gray-500">Active: <span className="font-medium text-green-600">{queueStats.active || 0}</span></span>
          </div>
        )}
      </div>

      {/* Email Feed */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Emails</h3>
        {logs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No emails sent yet. Start the dunning agent from the Invoices page.</p>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-lg mt-0.5">{statusIcon(log.status)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{log.subject}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${
                      ['opened', 'clicked'].includes(log.status) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      ['bounced', 'failed'].includes(log.status) ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                    }`}>{log.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    To: {log.recipient_email} · {log.email_type} · {formatDate(log.sent_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Activity;


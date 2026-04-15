import React from 'react';

export interface TimelineEvent {
  id: string;
  date: string | null;
  type: 'email' | 'sms' | 'phone' | 'plan' | 'payment' | 'agent';
  channel: string;
  title: string;
  subtitle?: string;
  status: 'done' | 'pending' | 'planned' | 'skipped';
  detail?: string;
}

interface DunningTimelineProps {
  events: TimelineEvent[];
  loading?: boolean;
  daysOverdue?: number;
}

function ChannelIcon({ type }: { type: TimelineEvent['type'] }) {
  switch (type) {
    case 'email':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    case 'sms':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'phone':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      );
    case 'plan':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      );
    case 'payment':
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3-.672 3-1.5S13.657 8 12 8zM12 14c-1.657 0-3 .672-3 1.5S10.343 17 12 17s3-.672 3-1.5S13.657 14 12 14z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

function StatusDot({ status }: { status: TimelineEvent['status'] }) {
  const classes = {
    done: 'bg-emerald-500 dark:bg-emerald-400',
    pending: 'bg-amber-400 dark:bg-amber-300 animate-pulse',
    planned: 'bg-gray-300 dark:bg-gray-600',
    skipped: 'bg-gray-200 dark:bg-gray-700',
  };
  return <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${classes[status]}`} />;
}

function formatEventDate(date: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const DunningTimeline: React.FC<DunningTimelineProps> = ({ events, loading, daysOverdue }) => {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 bg-gray-100 dark:bg-white/[0.04] rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-32" />
              <div className="h-3 bg-gray-100 dark:bg-white/[0.04] rounded w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="text-center py-10">
        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Agent hasn't acted yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {daysOverdue && daysOverdue > 0
            ? `Invoice is ${daysOverdue} days overdue — agent will queue on next run`
            : 'Invoice will be tracked when it becomes overdue'}
        </p>
      </div>
    );
  }

  const doneCount = events.filter(e => e.status === 'done').length;
  const totalCount = events.filter(e => e.status !== 'skipped').length;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all"
            style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {doneCount}/{totalCount} steps done
        </span>
      </div>

      {/* Events */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100 dark:bg-white/[0.05]" />

        <div className="space-y-1">
          {events.map((event) => (
            <div
              key={event.id}
              className={`relative flex gap-3 pl-1 rounded-lg p-2 transition-colors ${
                event.status === 'done'
                  ? 'hover:bg-gray-50 dark:hover:bg-white/[0.02]'
                  : event.status === 'pending'
                  ? 'bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20'
                  : ''
              }`}
            >
              {/* Icon circle */}
              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${
                event.status === 'done'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                  : event.status === 'pending'
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                  : 'bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-white/[0.06] text-gray-400 dark:text-gray-600'
              }`}>
                <ChannelIcon type={event.type} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium leading-tight truncate ${
                      event.status === 'done'
                        ? 'text-gray-900 dark:text-white'
                        : event.status === 'pending'
                        ? 'text-amber-900 dark:text-amber-200'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {event.title}
                    </p>
                    {event.subtitle && (
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 truncate">
                        {event.subtitle}
                      </p>
                    )}
                    {event.detail && event.status === 'done' && (
                      <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5 line-clamp-2 italic">
                        "{event.detail}"
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      event.status === 'done'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                        : event.status === 'pending'
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                        : event.status === 'planned'
                        ? 'bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-gray-500'
                        : 'bg-gray-50 dark:bg-white/[0.02] text-gray-400 dark:text-gray-600'
                    }`}>
                      {event.status === 'done' ? '✓ Done'
                        : event.status === 'pending' ? '● Next'
                        : event.status === 'planned' ? 'Planned'
                        : 'Skipped'}
                    </span>
                    {event.date && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-600 whitespace-nowrap">
                        {formatEventDate(event.date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100 dark:border-white/[0.05]">
        {[
          { status: 'done', label: 'Completed' },
          { status: 'pending', label: 'Next action' },
          { status: 'planned', label: 'Scheduled' },
          { status: 'skipped', label: 'Skipped' },
        ].map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5">
            <StatusDot status={status as TimelineEvent['status']} />
            <span className="text-[10px] text-gray-500 dark:text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DunningTimeline;

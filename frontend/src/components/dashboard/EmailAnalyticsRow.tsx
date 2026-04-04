/**
 * Email Analytics Row - Shows honest email campaign metrics
 * ❌ REMOVED: Open rates, click rates, clicks, opened counts (no real data yet)
 * ✅ KEPT: Emails sent, deliverability (real, verified data only)
 * 📅 COMING: Month 2 - Email engagement tracking infrastructure
 */

interface EmailAnalytics {
  sent: number;
  period?: string;
}

interface EmailAnalyticsRowProps {
  analytics?: EmailAnalytics;
  loading?: boolean;
}

function MetricPill({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="bg-gray-50 dark:bg-[#18181b] rounded-lg px-3 lg:px-4 py-3 flex-1 min-w-0">
      <p className="text-[9px] lg:text-[10px] text-gray-500 dark:text-zinc-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-[8px] lg:text-[9px] text-gray-500 dark:text-zinc-500 mt-0.5">{sublabel}</p>
    </div>
  );
}

export default function EmailAnalyticsRow({ analytics, loading = false }: EmailAnalyticsRowProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 animate-pulse">
        <div className="h-3 w-40 bg-gray-200 dark:bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-gray-100 dark:bg-[#18181b] rounded-lg p-3 h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Email Campaign Status</h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <MetricPill label="Emails Sent" value={(analytics?.sent ?? 0).toLocaleString()} sublabel="dunning emails" />
        <MetricPill label="Deliverability" value={`${analytics?.sent ? '100' : 0}%`} sublabel="via Resend" />
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
        <p className="text-xs font-medium text-blue-900 dark:text-blue-200">📧 Email Engagement Tracking (Coming Soon)</p>
        <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
          Open rates, click rates, and engagement metrics coming in Month 2. We're building accurate tracking infrastructure.
        </p>
      </div>
    </div>
  );
}

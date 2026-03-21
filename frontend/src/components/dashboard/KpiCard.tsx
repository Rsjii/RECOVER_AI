import { getBenchmarkStatus, BENCHMARKS } from '../../constants/benchmarks';

interface KpiCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: number;
  trendLabel?: string;
  metric?: keyof typeof BENCHMARKS;
  lowerIsBetter?: boolean;
  rawValue?: number;
  benchmark?: number;
  benchmarkLabel?: string;
  loading?: boolean;
}

export default function KpiCard({
  label,
  value,
  subValue,
  trend,
  trendLabel,
  metric,
  lowerIsBetter = false,
  rawValue,
  benchmark,
  benchmarkLabel,
  loading = false,
}: KpiCardProps) {
  const status = metric && rawValue !== undefined
    ? getBenchmarkStatus(rawValue, metric, lowerIsBetter)
    : null;

  const statusColor = {
    good: 'text-emerald-500',
    ok:   'text-amber-500',
    poor: 'text-rose-500',
  };

  const trendIsGood = lowerIsBetter ? (trend ?? 0) < 0 : (trend ?? 0) > 0;
  const trendColor  = trend === 0 || trend === undefined ? 'text-zinc-400 dark:text-zinc-400' : trendIsGood ? 'text-emerald-500' : 'text-rose-500';
  const trendArrow  = trend === undefined || trend === 0 ? '→' : trend > 0 ? '↑' : '↓';

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 animate-pulse">
        <div className="h-3 w-20 bg-gray-200 dark:bg-white/10 rounded mb-3" />
        <div className="h-7 w-24 bg-gray-200 dark:bg-white/10 rounded mb-2" />
        <div className="h-3 w-16 bg-gray-200 dark:bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 hover:border-gray-300 dark:hover:border-white/10 transition-colors">
      <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium uppercase tracking-wide mb-1">{label}</p>

      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-2xl font-bold ${status ? statusColor[status] : 'text-gray-900 dark:text-white'}`}>
          {value}
        </span>
        {subValue && (
          <span className="text-xs text-gray-500 dark:text-zinc-500">{subValue}</span>
        )}
      </div>

      <div className="flex items-center justify-between">
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trendColor}`}>
            {trendArrow} {Math.abs(trend)}% {trendLabel ?? 'vs last period'}
          </span>
        )}
        {benchmark !== undefined && (
          <span className="text-xs text-gray-500 dark:text-zinc-500 ml-auto">
            {benchmarkLabel ?? 'avg'} {benchmark}
          </span>
        )}
      </div>

      {status && (
        <div className={`mt-2 text-[10px] font-semibold uppercase tracking-wider ${statusColor[status]}`}>
          {status === 'good' ? '● Above target' : status === 'ok' ? '● On target' : '● Below target'}
        </div>
      )}
    </div>
  );
}

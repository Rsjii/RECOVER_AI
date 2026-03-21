import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useTheme } from '../../hooks/useTheme';

interface AgingBucket {
  label: string;
  days: string;
  amount: number;
  invoiceCount: number;
  pctOfTotal: number;
}

interface AgingAnalysisChartProps {
  buckets: AgingBucket[];
  totalAr: number;
  loading?: boolean;
}

const BUCKET_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

const fmt = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v.toFixed(0)}`;

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as AgingBucket;
  return (
    <div className="bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{d.label} ({d.days})</p>
      <p className="text-zinc-300">{fmt(d.amount)}</p>
      <p className="text-zinc-400">{d.invoiceCount} invoice{d.invoiceCount !== 1 ? 's' : ''}</p>
      <p className="text-zinc-400">{d.pctOfTotal}% of total A/R</p>
    </div>
  );
}

export default function AgingAnalysisChart({ buckets, totalAr, loading = false }: AgingAnalysisChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const labelColor = isDark ? '#a1a1aa' : '#71717a';

  if (loading) {
    return (
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 animate-pulse h-56">
        <div className="h-3 w-36 bg-white/10 rounded mb-4" />
        <div className="space-y-3 mt-6">
          {[80, 35, 20, 12].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 w-16 bg-white/10 rounded" />
              <div className="h-5 bg-white/10 rounded" style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const data = buckets.map((b, i) => ({ ...b, color: BUCKET_COLORS[i] }));

  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 flex-1">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-white">A/R Aging</h3>
        <span className="text-xs text-zinc-400">Total: {fmt(totalAr)}</span>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Unpaid invoices by days outstanding</p>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
          <XAxis type="number" hide axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: labelColor, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={62}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
            <LabelList
              dataKey="amount"
              position="right"
              formatter={(v: any) => fmt(Number(v))}
              style={{ fill: labelColor, fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend row */}
      <div className="flex gap-4 mt-3 flex-wrap">
        {buckets.map((b, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: BUCKET_COLORS[i] }} />
            <span className="text-[11px] text-zinc-400">{b.label} ({b.pctOfTotal}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

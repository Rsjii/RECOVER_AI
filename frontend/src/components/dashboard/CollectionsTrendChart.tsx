import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTheme } from '../../hooks/useTheme';

interface TimelinePoint {
  period: string;
  recovered_amount: number;
  total_amount: number;
}

interface CollectionsTrendChartProps {
  data: TimelinePoint[];
  loading?: boolean;
}

const fmt = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v.toFixed(0)}`;

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const date = new Date(label);
  const month = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  return (
    <div className="bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white mb-1">{month}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="mt-0.5">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function CollectionsTrendChart({ data, loading = false }: CollectionsTrendChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  const axisColor = isDark ? '#52525b' : '#d4d4d8';

  if (loading) {
    return (
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 animate-pulse h-56">
        <div className="h-3 w-32 bg-white/10 rounded mb-4" />
        <div className="h-36 bg-white/5 rounded mt-4" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 flex items-center justify-center h-56">
        <p className="text-xs text-zinc-500">No trend data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 flex-1 min-w-0">
      <h3 className="text-sm font-semibold text-white mb-1">Collections Trend</h3>
      <p className="text-xs text-zinc-500 mb-4">Monthly recovery vs total invoiced</p>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="period"
            tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short' })}
            tick={{ fill: axisColor, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={v => `$${(v / 1000).toFixed(0)}K`}
            tick={{ fill: axisColor, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="total_amount"
            name="Invoiced"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="recovered_amount"
            name="Recovered"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-emerald-500 rounded inline-block" />
          <span className="text-[11px] text-zinc-400">Recovered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-indigo-500 rounded inline-block" />
          <span className="text-[11px] text-zinc-400">Invoiced</span>
        </div>
      </div>
    </div>
  );
}

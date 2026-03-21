import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useTheme } from '../../hooks/useTheme';

interface RiskDrivers {
  failedPayment: number;
  expiringCard: number;
  inactivity: number;
  hardDecline: number;
  total: number;
}

interface RiskDriversChartProps {
  drivers?: RiskDrivers;
  loading?: boolean;
}

const DRIVER_META = [
  { key: 'failedPayment', label: 'Failed Payment', color: '#ef4444' },
  { key: 'expiringCard',  label: 'Expiring Card',  color: '#f97316' },
  { key: 'inactivity',    label: 'Inactivity 21d+', color: '#f59e0b' },
  { key: 'hardDecline',   label: 'Hard Decline',   color: '#8b5cf6' },
] as const;

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-white">{payload[0].payload.label}</p>
      <p className="text-zinc-300 mt-0.5">{payload[0].value} customers</p>
    </div>
  );
}

export default function RiskDriversChart({ drivers, loading = false }: RiskDriversChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const axisColor = isDark ? '#52525b' : '#d4d4d8';

  if (loading) {
    return (
      <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5 animate-pulse">
        <div className="h-3 w-28 bg-white/10 rounded mb-4" />
        <div className="space-y-3">
          {[3, 4, 2, 1].map((_, i) => (
            <div key={i} className="flex gap-2 items-center">
              <div className="h-2 w-24 bg-white/10 rounded" />
              <div className="h-5 bg-white/10 rounded flex-1" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const data = DRIVER_META.map(d => ({
    label: d.label,
    value: drivers?.[d.key] ?? 0,
    color: d.color,
  })).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const isEmpty = !data.length || (drivers?.total ?? 0) === 0;

  return (
    <div className="bg-[#111113] border border-white/[0.06] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-1">Risk Drivers</h3>
      <p className="text-xs text-zinc-500 mb-4">Customers flagged by signal</p>

      {isEmpty ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-xs text-zinc-500">No at-risk signals detected</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
              <XAxis type="number" hide axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: axisColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={88}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-3 pt-3 border-t border-white/[0.05] flex justify-between text-[11px]">
            <span className="text-zinc-500">Total risk signals</span>
            <span className="font-semibold text-white">{drivers?.total ?? 0} customers</span>
          </div>
        </>
      )}
    </div>
  );
}

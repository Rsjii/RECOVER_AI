const RISK_CONFIG: Record<string, { dot: string; text: string; bg: string; border: string; label: string }> = {
  critical: { dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/8', border: 'border-red-500/25', label: 'CRITICAL' },
  high:     { dot: 'bg-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/8', border: 'border-orange-500/25', label: 'HIGH' },
  medium:   { dot: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/8', border: 'border-yellow-500/25', label: 'MEDIUM' },
  low:      { dot: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/8', border: 'border-green-500/25', label: 'LOW' },
};

export default function RiskBadge({ level }: { level: string }) {
  const c = RISK_CONFIG[level] || RISK_CONFIG.low;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${c.text} ${c.bg} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`} style={{ animationDuration: '2s' }} />
      {c.label}
    </span>
  );
}

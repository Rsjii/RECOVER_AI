const RISK_CONFIG: Record<string, { dot: string; text: string; label: string }> = {
  critical: { dot: 'bg-red-500', text: 'text-red-400', label: 'CRITICAL' },
  high:     { dot: 'bg-orange-500', text: 'text-orange-400', label: 'HIGH' },
  medium:   { dot: 'bg-yellow-500', text: 'text-yellow-400', label: 'MEDIUM' },
  low:      { dot: 'bg-green-500', text: 'text-green-400', label: 'LOW' },
};

interface Service { service_path: string; risk_level: string; relation_type: string; }

export default function AffectedServices({ services }: { services: Service[] }) {
  if (!services || services.length === 0) {
    return <p className="text-slate-600 text-sm">No direct service dependencies found.</p>;
  }
  return (
    <div className="space-y-1.5">
      {services.map((s, i) => {
        const c = RISK_CONFIG[s.risk_level] || RISK_CONFIG.low;
        return (
          <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
            <span className="text-slate-300 text-sm font-mono truncate flex-1">{s.service_path}</span>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              <span className="text-slate-600 text-xs">{s.relation_type}</span>
              <span className={`flex items-center gap-1.5 text-xs font-medium ${c.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {c.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

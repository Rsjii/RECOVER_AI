import KpiCard from './KpiCard';

interface DashboardKpi {
  dso: number;
  cei: number;
  recoveryRate: number;
  revenueAtRisk: number;
  revenueAtRiskPct: number;
  involuntaryChurnRate: number;
  atRiskCustomerCount: number;
  totalCustomers: number;
}

interface KpiRowProps {
  kpi?: DashboardKpi;
  loading?: boolean;
}

export default function KpiRow({ kpi, loading = false }: KpiRowProps) {
  const atRiskPct = kpi && kpi.totalCustomers > 0
    ? Math.round((kpi.atRiskCustomerCount / kpi.totalCustomers) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <KpiCard
        label="DSO"
        value={loading ? '—' : `${kpi?.dso ?? 0}d`}
        subValue="days sales outstanding"
        metric="dso"
        lowerIsBetter
        rawValue={kpi?.dso}
        benchmark={40}
        benchmarkLabel="SaaS avg"
        loading={loading}
      />
      <KpiCard
        label="CEI"
        value={loading ? '—' : `${kpi?.cei ?? 0}%`}
        subValue="collection effectiveness"
        metric="cei"
        rawValue={kpi?.cei}
        benchmark={85}
        benchmarkLabel="target"
        loading={loading}
      />
      <KpiCard
        label="Recovery Rate"
        value={loading ? '—' : `${kpi?.recoveryRate ?? 0}%`}
        subValue="of overdue $ recovered"
        metric="recoveryRate"
        rawValue={kpi?.recoveryRate}
        benchmark={70}
        benchmarkLabel="target"
        loading={loading}
      />
      <KpiCard
        label="Revenue at Risk"
        value={loading ? '—' : `$${((kpi?.revenueAtRisk ?? 0) / 1000).toFixed(0)}K`}
        subValue={kpi ? `${kpi.revenueAtRiskPct}% of A/R` : undefined}
        metric="revenueAtRisk"
        lowerIsBetter
        rawValue={kpi?.revenueAtRiskPct}
        benchmark={10}
        benchmarkLabel="target <"
        loading={loading}
      />
      <KpiCard
        label="Involuntary Churn"
        value={loading ? '—' : `${kpi?.involuntaryChurnRate ?? 0}%`}
        subValue="last 30 days"
        metric="involuntaryChurn"
        lowerIsBetter
        rawValue={kpi?.involuntaryChurnRate}
        benchmark={2}
        benchmarkLabel="target <"
        loading={loading}
      />
      <KpiCard
        label="At-Risk Customers"
        value={loading ? '—' : `${kpi?.atRiskCustomerCount ?? 0}`}
        subValue={kpi && kpi.totalCustomers > 0 ? `${atRiskPct}% of base` : undefined}
        loading={loading}
      />
    </div>
  );
}

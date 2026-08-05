import React from 'react';
import { TrendingUp, TrendingDown, Minus, DollarSign, AlertTriangle, BarChart3, Calendar, FileText, Zap } from 'lucide-react';

interface ARHealthData {
  totalAR: number;
  overdueAR: number;
  overdueBreakdown: { days_30: number; days_60: number; days_90: number };
  invoiceCount: number;
  paymentRate: number;
}

interface ARHealthGridProps {
  arHealth: ARHealthData;
  avgDaysToPay: number;
  riskTrend: { current: number; previous: number; direction: 'up' | 'down' | 'stable'; points: number };
}

interface StatCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'stable';
  color?: 'red' | 'green' | 'blue' | 'gray' | 'amber';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, subtext, trend, color = 'blue' }) => {
  const colorClasses = {
    red: 'bg-gradient-to-br from-red-50 to-red-25 dark:from-red-950/40 dark:to-red-900/30 border-red-200 dark:border-red-800/50',
    green: 'bg-gradient-to-br from-green-50 to-green-25 dark:from-green-950/40 dark:to-green-900/30 border-green-200 dark:border-green-800/50',
    blue: 'bg-gradient-to-br from-blue-50 to-blue-25 dark:from-blue-950/40 dark:to-blue-900/30 border-blue-200 dark:border-blue-800/50',
    gray: 'bg-gradient-to-br from-gray-50 to-gray-25 dark:from-slate-800/40 dark:to-slate-700/30 border-gray-200 dark:border-slate-700/50',
    amber: 'bg-gradient-to-br from-amber-50 to-amber-25 dark:from-amber-950/40 dark:to-amber-900/30 border-amber-200 dark:border-amber-800/50',
  };

  const textClasses = {
    red: 'text-red-900 dark:text-red-200',
    green: 'text-green-900 dark:text-green-200',
    blue: 'text-blue-900 dark:text-blue-200',
    gray: 'text-gray-900 dark:text-gray-200',
    amber: 'text-amber-900 dark:text-amber-200',
  };

  const labelClasses = {
    red: 'text-red-700 dark:text-red-300',
    green: 'text-green-700 dark:text-green-300',
    blue: 'text-blue-700 dark:text-blue-300',
    gray: 'text-gray-700 dark:text-gray-300',
    amber: 'text-amber-700 dark:text-amber-300',
  };

  const iconClasses = {
    red: 'text-red-600 dark:text-red-400',
    green: 'text-green-600 dark:text-green-400',
    blue: 'text-blue-600 dark:text-blue-400',
    gray: 'text-gray-600 dark:text-gray-400',
    amber: 'text-amber-600 dark:text-amber-400',
  };

  return (
    <div className={`rounded-xl p-6 border ${colorClasses[color]}`}>
      <div className="flex items-start justify-between mb-4">
        {icon && <div className={`flex-shrink-0 ${iconClasses[color]}`}>{icon}</div>}
        {trend && (
          <div className="flex items-center">
            {trend === 'up' && <TrendingUp size={18} className="text-red-500 dark:text-red-400" />}
            {trend === 'down' && <TrendingDown size={18} className="text-green-500 dark:text-green-400" />}
            {trend === 'stable' && <Minus size={18} className="text-gray-400" />}
          </div>
        )}
      </div>
      <div className={`text-xs font-semibold ${labelClasses[color]} uppercase tracking-wide mb-2`}>
        {label}
      </div>
      <div className={`text-3xl font-bold ${textClasses[color]}`}>{value}</div>
      {subtext && <div className={`text-xs ${labelClasses[color]} mt-3 opacity-75`}>{subtext}</div>}
    </div>
  );
};

export const ARHealthGrid: React.FC<ARHealthGridProps> = ({ arHealth, avgDaysToPay, riskTrend }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-6 py-6">
      {/* Card 1: Total AR */}
      <StatCard
        icon={<DollarSign size={24} />}
        label="Total AR"
        value={`€${arHealth.totalAR.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        color="red"
      />

      {/* Card 2: Overdue AR */}
      <StatCard
        icon={<AlertTriangle size={24} />}
        label="Overdue AR"
        value={`€${arHealth.overdueAR.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        subtext={`30d: €${arHealth.overdueBreakdown.days_30.toLocaleString()} | 60d: €${arHealth.overdueBreakdown.days_60.toLocaleString()} | 90d+: €${arHealth.overdueBreakdown.days_90.toLocaleString()}`}
        color="red"
      />

      {/* Card 3: Payment Rate */}
      <StatCard
        icon={<BarChart3 size={24} />}
        label="Payment Rate"
        value={`${arHealth.paymentRate}%`}
        color={arHealth.paymentRate >= 80 ? 'green' : 'amber'}
      />

      {/* Card 4: Avg Days to Pay */}
      <StatCard
        icon={<Calendar size={24} />}
        label="Avg Days to Pay"
        value={`${avgDaysToPay}d`}
        color={avgDaysToPay <= 15 ? 'green' : avgDaysToPay <= 30 ? 'blue' : 'red'}
      />

      {/* Card 5: Invoice Count */}
      <StatCard
        icon={<FileText size={24} />}
        label="Unpaid Invoices"
        value={arHealth.invoiceCount}
        color={arHealth.invoiceCount === 0 ? 'green' : arHealth.invoiceCount <= 5 ? 'blue' : 'red'}
      />

      {/* Card 6: Risk Trend */}
      <StatCard
        icon={<Zap size={24} />}
        label="Risk Trend"
        value={`${riskTrend.current}/100`}
        subtext={`${riskTrend.previous > 0 ? `Was ${riskTrend.previous}` : 'New'} (${riskTrend.points >= 0 ? '+' : ''}${riskTrend.points})`}
        trend={riskTrend.direction}
        color={riskTrend.current >= 75 ? 'red' : riskTrend.current >= 50 ? 'amber' : 'green'}
      />
    </div>
  );
};

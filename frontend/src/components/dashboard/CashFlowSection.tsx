import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { CollapsibleSection } from './CollapsibleSection';
import { RunwayWidget } from './RunwayWidget';
import { CashPositionWidget } from './CashPositionWidget';
import { WhatIfWidget } from './WhatIfWidget';
import { CashLeakageWidget } from './CashLeakageWidget';
import type { RunwayData } from './RunwayWidget';
import type { CashLeakageData } from './CashLeakageWidget';
import type { EnhancedCashForecast } from '../../types/invoice';

interface CashPosition {
  currentBalance: number;
  balance30: number;
  balance60: number;
  balance90: number;
  pendingInvoices30: number;
  pendingInvoices60: number;
  pendingInvoices90: number;
  invoiceCount: number;
  asOfDate: string;
}

interface WhatIfCustomer {
  id: string;
  name: string;
  totalOwed: number;
}

const fmtDollar = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${Math.round(v / 1_000)}k` : `$${v}`;

const fmtShortDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface CashFlowSectionProps {
  runway: RunwayData | null;
  cashPosition: CashPosition | null;
  leakage: CashLeakageData | null;
  customers: WhatIfCustomer[];
  cashBalanceInput: string;
  onBalanceChange: (value: string) => void;
  onBalanceSubmit: () => void;
  onWhatIf: (scenario: any) => Promise<any>;
  forecast?: EnhancedCashForecast | null;
  loading?: boolean;
}

export const CashFlowSection: React.FC<CashFlowSectionProps> = ({
  runway,
  cashPosition,
  leakage,
  customers,
  cashBalanceInput,
  onBalanceChange,
  onBalanceSubmit,
  onWhatIf,
  forecast,
  loading = false,
}) => {
  if (!runway && !cashPosition && !leakage && !forecast) {
    return null;
  }

  // Sample every 3rd day → ~30 data points for the chart
  const forecastData = forecast
    ? forecast.forecastDays
        .filter((_, i) => i % 3 === 0)
        .map((d) => ({
          date: fmtShortDate(d.date),
          balance: Math.round(d.projectedBalance),
          low: Math.round(d.confidenceBand.low),
          high: Math.round(d.confidenceBand.high),
        }))
    : [];

  const trendColor =
    forecast?.trend === 'improving' ? '#10b981' : forecast?.trend === 'declining' ? '#f43f5e' : '#f59e0b';

  return (
    <CollapsibleSection
      title="Cash Flow & Projections"
      subtitle="Runway, balance, and financial modeling"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
    >
      <div className="space-y-4">
        {/* 90-Day Cash Forecast Chart */}
        {forecast && forecastData.length > 0 && (
          <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.05] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">90-Day Cash Forecast</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Trend:{' '}
                  <span
                    className={`font-medium capitalize ${
                      forecast.trend === 'improving'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : forecast.trend === 'declining'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {forecast.trend}
                  </span>
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Avg collection: {(forecast.historicalAvgCollectionRate * 100).toFixed(1)}%
              </p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={forecastData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={fmtDollar}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(value: number | undefined, name: string | undefined) => [
                    fmtDollar(value ?? 0),
                    name === 'balance' ? 'Projected' : name === 'low' ? 'Low' : 'High',
                  ] as [string, string]}
                  labelStyle={{ color: '#6b7280', fontSize: 11 }}
                  contentStyle={{
                    background: 'var(--tooltip-bg, white)',
                    border: '1px solid rgba(148,163,184,0.2)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                {cashPosition?.currentBalance ? (
                  <ReferenceLine
                    y={cashPosition.currentBalance}
                    stroke="rgba(148,163,184,0.4)"
                    strokeDasharray="4 4"
                    label={{ value: 'Today', position: 'insideTopLeft', fontSize: 10, fill: '#94a3b8' }}
                  />
                ) : null}
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke={trendColor}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-2 text-center">
              Based on historical collection rates · ±15% confidence band not shown
            </p>
          </div>
        )}

        {/* Runway Widget */}
        {runway && <RunwayWidget runway={runway} loading={loading} />}

        {/* Cash Position + What If */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cashPosition && (
            <CashPositionWidget
              cashPosition={cashPosition}
              cashBalanceInput={cashBalanceInput}
              onBalanceChange={onBalanceChange}
              onBalanceSubmit={onBalanceSubmit}
              loading={loading}
            />
          )}
          {customers.length > 0 && (
            <WhatIfWidget onCalculate={onWhatIf} customers={customers} />
          )}
        </div>

        {/* Cash Leakage */}
        {leakage && <CashLeakageWidget leakage={leakage} loading={loading} />}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Cash Projections</p>
          <p className="text-sm text-blue-800 dark:text-blue-300 mt-2">
            These projections show your estimated cash position over the next 90 days based on current receivables. Update your actual cash balance to get accurate runway estimates.
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );
};

export default CashFlowSection;

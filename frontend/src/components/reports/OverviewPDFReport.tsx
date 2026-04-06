import React from 'react';
import { format } from 'date-fns';
import { BENCHMARKS } from '../../constants/benchmarks';

interface TimelinePoint {
  period: string;
  recovered_amount: number;
  amount_created: number;
  recovered_count: number;
  total_count: number;
}

interface KpiTrendPoint {
  month: string;
  recoveryRate: number;
  recovered: number;
  total: number;
  emailsSent: number;
  openRate: number;
  ctr: number;
}

interface DashboardStats {
  totalOwed: number;
  totalRecovered: number;
  recoveryRate: number;
  avgDaysToCollect: number;
  overdueCount: number;
}

interface OverviewPDFReportProps {
  stats: DashboardStats | null;
  timeline: TimelinePoint[];
  kpiTrends: KpiTrendPoint[];
  months: number;
}

export const OverviewPDFReport: React.FC<OverviewPDFReportProps> = ({
  stats,
  timeline,
  kpiTrends,
  months,
}) => {
  const today = new Date();
  const monthsAgo = new Date(today);
  monthsAgo.setMonth(monthsAgo.getMonth() - months);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div id="report-content" style={{ width: '100%', backgroundColor: '#ffffff', padding: '48px', fontSize: '14px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111827' }}>
      {/* Header */}
      <div style={{ borderBottom: '2px solid #d1d5db', paddingBottom: '2rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '30px', fontWeight: 'bold', color: '#4f46e5', marginBottom: '0.5rem' }}>RecoverAI Reports</h1>
        <p style={{ fontSize: '14px', color: '#4b5563' }}>Accounts Receivable Recovery Dashboard</p>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '0.5rem' }}>
          Report Period: {format(monthsAgo, 'MMM dd, yyyy')} — {format(today, 'MMM dd, yyyy')}
        </p>
      </div>

      {/* Executive Summary KPIs */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Executive Summary</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #d1d5db' }}>
              <td style={{ padding: '12px 16px', backgroundColor: '#f9fafb', fontWeight: '600', color: '#374151', width: '50%' }}>Recovery Rate</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '22px', fontWeight: 'bold', color: '#059669' }}>{stats?.recoveryRate ?? 0}%</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #d1d5db' }}>
              <td style={{ padding: '12px 16px', backgroundColor: '#f9fafb', fontWeight: '600', color: '#374151', width: '50%' }}>Total Recovered (All Time)</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '22px', fontWeight: 'bold', color: '#2563eb' }}>{formatCurrency(stats?.totalRecovered ?? 0)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #d1d5db' }}>
              <td style={{ padding: '12px 16px', backgroundColor: '#f9fafb', fontWeight: '600', color: '#374151', width: '50%' }}>Days Sales Outstanding (DSO)</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '22px', fontWeight: 'bold', color: '#4f46e5' }}>{stats?.avgDaysToCollect ?? 0}d</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #d1d5db' }}>
              <td style={{ padding: '12px 16px', backgroundColor: '#f9fafb', fontWeight: '600', color: '#374151', width: '50%' }}>Overdue Invoices</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '22px', fontWeight: 'bold', color: '#d97706' }}>{stats?.overdueCount ?? 0}</td>
            </tr>
            <tr>
              <td style={{ padding: '12px 16px', backgroundColor: '#f9fafb', fontWeight: '600', color: '#374151', width: '50%' }}>Target Recovery Rate</td>
              <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '18px', color: '#4b5563' }}>{BENCHMARKS.recoveryRate.target}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Recovery Timeline */}
      {timeline.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>Recovery Timeline (Last {months} Months)</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#e5e7eb', borderBottom: '1px solid #d1d5db' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Period</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Recovered</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Invoiced</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Count Recovered</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Count Total</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '8px 12px', color: '#374151', fontWeight: '500' }}>{row.period.slice(0, 7)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>{formatCurrency(row.recovered_amount)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>{formatCurrency(row.amount_created)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', color: '#374151' }}>{row.recovered_count}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', color: '#374151' }}>{row.total_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* KPI Trends */}
      {kpiTrends.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>KPI Trends</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#e5e7eb', borderBottom: '1px solid #d1d5db' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Month</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Recovery Rate</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Email Open Rate</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Click Rate</th>
              </tr>
            </thead>
            <tbody>
              {kpiTrends.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '8px 12px', color: '#374151', fontWeight: '500' }}>{row.month}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>{row.recoveryRate.toFixed(1)}%</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>{row.openRate.toFixed(1)}%</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#374151' }}>{row.ctr.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '2px solid #d1d5db', paddingTop: '1.5rem', marginTop: '3rem', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
        <p>Generated by RecoverAI on {format(today, 'MMMM dd, yyyy')} at {format(today, 'HH:mm:ss')}</p>
        <p style={{ marginTop: '0.25rem' }}>Confidential — For authorized users only</p>
      </div>
    </div>
  );
};

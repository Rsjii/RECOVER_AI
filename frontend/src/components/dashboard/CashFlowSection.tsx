import React from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import { RunwayWidget } from './RunwayWidget';
import { CashPositionWidget } from './CashPositionWidget';
import { WhatIfWidget } from './WhatIfWidget';
import { CashLeakageWidget } from './CashLeakageWidget';
import type { RunwayData } from './RunwayWidget';
import type { CashLeakageData } from './CashLeakageWidget';

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

interface CashFlowSectionProps {
  runway: RunwayData | null;
  cashPosition: CashPosition | null;
  leakage: CashLeakageData | null;
  customers: WhatIfCustomer[];
  cashBalanceInput: string;
  onBalanceChange: (value: string) => void;
  onBalanceSubmit: () => void;
  onWhatIf: (scenario: any) => Promise<any>;
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
  loading = false,
}) => {
  if (!runway && !cashPosition && !leakage) {
    return null;
  }

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

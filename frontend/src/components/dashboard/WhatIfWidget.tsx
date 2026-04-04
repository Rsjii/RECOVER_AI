import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface WhatIfScenario {
  type: 'remove_customer' | 'accelerate_dunning' | 'custom';
  removeCustomerId?: string;
  customReductionPct?: number;
}

interface WhatIfResult {
  baselineBalance30: number;
  baselineBalance60: number;
  baselineBalance90: number;
  scenarioBalance30: number;
  scenarioBalance60: number;
  scenarioBalance90: number;
  impactAmount: number;
  impactDescription: string;
  customerName?: string;
}

interface CustomerOption {
  id: string;
  name: string;
  totalOwed: number;
}

interface WhatIfWidgetProps {
  onCalculate: (scenario: WhatIfScenario) => Promise<WhatIfResult>;
  customers: CustomerOption[];
}

const fmtUsd = (n: number) => `$${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const WhatIfWidget: React.FC<WhatIfWidgetProps> = ({ onCalculate, customers }) => {
  const [scenarioType, setScenarioType] = useState<WhatIfScenario['type']>('remove_customer');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [reductionPct, setReductionPct] = useState('20');
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const scenario: WhatIfScenario = { type: scenarioType };
      if (scenarioType === 'remove_customer') scenario.removeCustomerId = selectedCustomer;
      if (scenarioType === 'custom') scenario.customReductionPct = parseFloat(reductionPct) || 20;
      const res = await onCalculate(scenario);
      setResult(res);
    } catch {
      // Error handled by parent
    } finally {
      setCalculating(false);
    }
  };

  const canCalculate =
    (scenarioType === 'remove_customer' && selectedCustomer) ||
    scenarioType === 'accelerate_dunning' ||
    (scenarioType === 'custom' && parseFloat(reductionPct) > 0);

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">What-If Scenarios</h3>

      {/* Scenario selector */}
      <div className="space-y-3 mb-4">
        <select
          value={scenarioType}
          onChange={(e) => { setScenarioType(e.target.value as WhatIfScenario['type']); setResult(null); }}
          className="w-full text-sm border border-gray-200 dark:border-white/[0.1] rounded-lg px-3 py-2 bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="remove_customer">What if we lose a customer?</option>
          <option value="accelerate_dunning">What if we accelerate dunning?</option>
          <option value="custom">What if revenue drops by X%?</option>
        </select>

        {scenarioType === 'remove_customer' && (
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="w-full text-sm border border-gray-200 dark:border-white/[0.1] rounded-lg px-3 py-2 bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} (${c.totalOwed.toLocaleString()} owed)</option>
            ))}
          </select>
        )}

        {scenarioType === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="100"
              value={reductionPct}
              onChange={(e) => setReductionPct(e.target.value)}
              className="w-20 text-sm border border-gray-200 dark:border-white/[0.1] rounded-lg px-3 py-2 bg-gray-50 dark:bg-white/[0.03] text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">% revenue reduction</span>
          </div>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={handleCalculate}
          disabled={!canCalculate || calculating}
        >
          {calculating ? 'Calculating...' : 'Calculate Impact'}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="border-t border-gray-100 dark:border-white/[0.06] pt-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">{result.impactDescription}</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
            {[
              { label: '30d', baseline: result.baselineBalance30, scenario: result.scenarioBalance30 },
              { label: '60d', baseline: result.baselineBalance60, scenario: result.scenarioBalance60 },
              { label: '90d', baseline: result.baselineBalance90, scenario: result.scenarioBalance90 },
            ].map((col) => {
              const diff = col.scenario - col.baseline;
              return (
                <div key={col.label} className="bg-gray-50 dark:bg-white/[0.03] rounded-lg p-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500">{col.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-through">{fmtUsd(col.baseline)}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{fmtUsd(col.scenario)}</p>
                  <p className={`text-xs font-medium ${diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {diff >= 0 ? '+' : '-'}{fmtUsd(diff)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};

import React, { useState } from 'react';
import { CollapsibleSection } from './CollapsibleSection';
import { Button } from '../ui/Button';

interface TrialForecastChartProps {
  runwayDays: number;
  availableCash: number;
  trend?: {
    direction: 'improving' | 'worsening' | 'stable';
    percent_change: number;
  };
}

const TrialForecastChart: React.FC<TrialForecastChartProps> = ({ runwayDays, availableCash, trend }) => {
  const [scenarioActive, setScenarioActive] = useState<string | null>(null);

  const handleScenario = (scenario: string) => {
    setScenarioActive(scenario);
  };

  const trendEmoji =
    trend?.direction === 'improving' ? '↗ Up' : trend?.direction === 'worsening' ? '↘ Down' : '→ Stable';

  const runwayStatus =
    runwayDays > 60 ? { label: 'Healthy', color: 'text-green-600 dark:text-green-400' } : runwayDays > 30
      ? { label: 'Caution', color: 'text-yellow-600 dark:text-yellow-400' }
      : { label: 'Critical', color: 'text-red-600 dark:text-red-400' };

  return (
    <>
      {/* 13-Week Forecast Chart */}
      <CollapsibleSection title="📈 13-Week Cash Forecast" defaultOpen={true}>
        <div className="space-y-4">
          {/* Forecast Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-gray-600 dark:text-gray-400">Current Runway</div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{runwayDays}d</div>
            </div>
            <div
              className={`rounded-lg p-4 border ${
                runwayDays > 60
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : runwayDays > 30
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}
            >
              <div className="text-sm text-gray-600 dark:text-gray-400">Runway Status</div>
              <div className={`text-2xl font-bold mt-1 ${runwayStatus.color}`}>{runwayStatus.label}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
              <div className="text-sm text-gray-600 dark:text-gray-400">Trend</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{trendEmoji}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
              <div className="text-sm text-gray-600 dark:text-gray-400">Forecast</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Available</div>
            </div>
          </div>

          {/* Runway Timeline */}
          <div className="bg-gray-50 dark:bg-slate-900 rounded-lg p-4 mt-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Runway Timeline</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Today</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ${Math.round(availableCash / 1000)}K cash, {runwayDays}d runway
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Week 4</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ~${Math.round((availableCash * 0.8) / 1000)}K cash, {Math.round(runwayDays * 0.7)}d runway
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Week 8</span>
                <span
                  className={`font-semibold ${
                    runwayDays > 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  ~${Math.round((availableCash * 0.5) / 1000)}K cash, {Math.round(runwayDays * 0.4)}d runway{' '}
                  {runwayDays < 60 && '⚠️'}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              💡 {runwayDays > 60 ? 'You have time. Start fundraising by week 8.' : 'Start fundraising immediately.'}
            </p>
          </div>
        </div>
      </CollapsibleSection>

      {/* Scenario Testing */}
      <CollapsibleSection title="🎯 What-If Scenarios" defaultOpen={true}>
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Test different growth rates to see impact on runway</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant={scenarioActive === 'growth-20' ? 'primary' : 'secondary'}
              onClick={() => handleScenario('growth-20')}
              className="text-sm"
            >
              Growth -20%?
            </Button>
            <Button
              variant={scenarioActive === 'growth-50' ? 'primary' : 'secondary'}
              onClick={() => handleScenario('growth-50')}
              className="text-sm"
            >
              Growth -50%?
            </Button>
            <Button
              variant={scenarioActive === 'hire' ? 'primary' : 'secondary'}
              onClick={() => handleScenario('hire')}
              className="text-sm"
            >
              Hire 5 people?
            </Button>
          </div>
          {scenarioActive && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                📊 Impact: Scenario "{scenarioActive}" would change your runway. Update your assumptions to see the full
                impact.
              </p>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </>
  );
};

export default TrialForecastChart;

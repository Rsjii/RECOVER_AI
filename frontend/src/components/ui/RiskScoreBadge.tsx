import React, { useState, useRef, useEffect } from 'react';

interface RiskFactor {
  label: string;
  impact: number; // positive = increases risk, negative = reduces risk
}

interface RiskScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  factors?: RiskFactor[];
}

function getRiskLevel(score: number): {
  label: string;
  color: string;
  bg: string;
  border: string;
  description: string;
  action: string;
} {
  if (score >= 80) return {
    label: 'Critical',
    color: 'text-red-700 dark:text-red-300',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    description: 'Immediate escalation required. High probability of default.',
    action: 'Phone call + final notice recommended',
  };
  if (score >= 50) return {
    label: 'High',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    description: 'Elevated risk. Agent will escalate dunning cadence.',
    action: 'Email + SMS automation active',
  };
  if (score >= 20) return {
    label: 'Medium',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    description: 'Moderate risk. Standard dunning sequence in progress.',
    action: 'Email automation active',
  };
  return {
    label: 'Low',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    description: 'Low risk. Likely to pay with standard reminders.',
    action: 'Soft email sequence active',
  };
}

const DEFAULT_FACTORS: RiskFactor[] = [
  { label: 'Days overdue', impact: 25 },
  { label: 'Payment history', impact: 20 },
  { label: 'Invoice size', impact: 15 },
  { label: 'Prior communications', impact: -10 },
];

export const RiskScoreBadge: React.FC<RiskScoreBadgeProps> = ({
  score,
  size = 'md',
  showLabel = true,
  factors,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const level = getRiskLevel(score);
  const displayFactors = factors ?? DEFAULT_FACTORS;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  };

  const numberClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold border cursor-pointer transition-opacity hover:opacity-80 ${sizeClasses[size]} ${level.color} ${level.bg} ${level.border}`}
        title="Click to see risk breakdown"
      >
        <span className={`font-bold ${numberClasses[size]}`}>{score}</span>
        {showLabel && <span>{level.label}</span>}
        <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-64 bg-white dark:bg-[#1a1a1d] border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-xl p-4 space-y-3">
          {/* Score header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Risk Score</p>
              <p className={`text-2xl font-bold ${level.color}`}>{score}<span className="text-sm font-normal text-gray-400">/100</span></p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${level.color} ${level.bg} ${level.border}`}>
              {level.label}
            </span>
          </div>

          {/* Scale */}
          <div>
            <div className="flex justify-between text-[9px] text-gray-400 dark:text-gray-500 mb-1">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
              <span>Critical</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-white/[0.05] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 via-orange-400 to-red-500" />
            </div>
            <div className="relative h-1 mt-0.5">
              <div
                className="absolute top-0 w-2 h-2 rounded-full bg-white border-2 border-gray-800 dark:border-white -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${Math.min(score, 99)}%` }}
              />
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-gray-600 dark:text-gray-400">{level.description}</p>

          {/* Factors */}
          <div>
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Score Factors</p>
            <div className="space-y-1.5">
              {displayFactors.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{f.label}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    f.impact > 0
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                      : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {f.impact > 0 ? `+${f.impact}` : f.impact}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action */}
          <div className="pt-2 border-t border-gray-100 dark:border-white/[0.06]">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Agent Action</p>
            <p className="text-xs text-gray-700 dark:text-gray-300">{level.action}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskScoreBadge;

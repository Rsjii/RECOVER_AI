import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useNotification } from '../../hooks/useNotification';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../lib/utils';

export interface ForecastAssumptions {
  id: string;
  company_id: string;
  growth_rate_pct: number;
  payroll_amount_monthly: number | null;
  other_expenses_monthly: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface WeeklyUpdateFormProps {
  onClose?: () => void;
}

export const WeeklyUpdateForm: React.FC<WeeklyUpdateFormProps> = ({ onClose }) => {
  const [assumptions, setAssumptions] = useState<ForecastAssumptions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    growth_rate_pct: 0,
    payroll_amount_monthly: '',
    other_expenses_monthly: '',
    notes: '',
  });
  const { addToast } = useNotification();

  useEffect(() => {
    fetchAssumptions();
  }, []);

  const fetchAssumptions = async () => {
    setIsLoading(true);
    try {
      // Try to fetch existing assumptions
      const res = await api.get<{ data: ForecastAssumptions[] }>('/api/forecast-assumptions');
      const existing = res.data?.[0];
      if (existing) {
        setAssumptions(existing);
        setFormData({
          growth_rate_pct: existing.growth_rate_pct,
          payroll_amount_monthly: String(existing.payroll_amount_monthly || ''),
          other_expenses_monthly: String(existing.other_expenses_monthly || ''),
          notes: existing.notes || '',
        });
      }
    } catch (err: any) {
      // Non-critical: if endpoint doesn't exist yet, just use defaults
      if (err.status !== 404) {
        addToast({
          type: 'error',
          message: err.message || 'Failed to load assumptions',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payroll = formData.payroll_amount_monthly ? parseFloat(formData.payroll_amount_monthly) : null;
      const otherExpenses = formData.other_expenses_monthly ? parseFloat(formData.other_expenses_monthly) : null;
      const growthRate = parseFloat(formData.growth_rate_pct.toString());

      if (isNaN(growthRate)) {
        addToast({
          type: 'error',
          message: 'Invalid growth rate percentage',
        });
        return;
      }

      const payload = {
        growth_rate_pct: growthRate,
        payroll_amount_monthly: payroll,
        other_expenses_monthly: otherExpenses,
        notes: formData.notes || null,
      };

      if (assumptions) {
        // Update existing
        await api.put(`/api/forecast-assumptions/${assumptions.id}`, payload);
        addToast({
          type: 'success',
          message: 'Forecast assumptions updated',
        });
      } else {
        // Create new
        await api.post('/api/forecast-assumptions', payload);
        addToast({
          type: 'success',
          message: 'Forecast assumptions saved',
        });
      }

      if (onClose) {
        onClose();
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to save assumptions',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Weekly Forecast Update</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Adjust your forecast assumptions to improve accuracy
        </p>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Growth Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Monthly Growth Rate (%)
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={formData.growth_rate_pct}
                  onChange={e => setFormData(prev => ({ ...prev, growth_rate_pct: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
                <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">%</span>
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {formData.growth_rate_pct > 0 ? `+${formData.growth_rate_pct.toFixed(1)}%` : formData.growth_rate_pct < 0 ? `${formData.growth_rate_pct.toFixed(1)}%` : 'Flat'}
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Expected monthly revenue growth. Positive = growing, negative = declining, 0 = flat.
          </p>
        </div>

        {/* Payroll Expense */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Monthly Payroll (Optional)
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.payroll_amount_monthly}
                  onChange={e => setFormData(prev => ({ ...prev, payroll_amount_monthly: e.target.value }))}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            {formData.payroll_amount_monthly && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {formatCurrency(parseFloat(formData.payroll_amount_monthly))}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Typical monthly salary expenses for your team
          </p>
        </div>

        {/* Other Expenses */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Other Monthly Expenses (Optional)
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.other_expenses_monthly}
                  onChange={e => setFormData(prev => ({ ...prev, other_expenses_monthly: e.target.value }))}
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>
            {formData.other_expenses_monthly && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {formatCurrency(parseFloat(formData.other_expenses_monthly))}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            AWS, cloud services, marketing, rent, etc. (everything except payroll)
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
            placeholder="Any notes about this forecast adjustment..."
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            What changed? What should we know?
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              💡 <strong>Tip:</strong> Update these assumptions weekly to keep your forecast accurate. The more data you provide, the better the forecast becomes.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          {onClose && (
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1"
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            loading={isSaving}
            disabled={isLoading}
            className={onClose ? 'flex-1' : 'w-full'}
          >
            Save Assumptions
          </Button>
        </div>
      </form>
    </div>
  );
};

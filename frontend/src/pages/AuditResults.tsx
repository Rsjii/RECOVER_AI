import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useNotification } from '../hooks/useNotification';

const AuditResults: React.FC = () => {
  const { auditId } = useParams<{ auditId: string }>();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const navigate = useNavigate();
  const { addToast } = useNotification();
  
  const [audit, setAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const result = await api.get(`/api/audits/${auditId}`);
        setAudit(result);
      } catch (err: any) {
        addToast({
          type: 'error',
          message: err.message || 'Failed to load audit',
        });
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    if (auditId) {
      fetchAudit();
    }
  }, [auditId]);

  const handleConvertToPilot = async () => {
    setConverting(true);
    try {
      await api.post('/api/audits/convert-to-pilot', {
        audit_id: auditId,
        invite_token: inviteToken || undefined,
      });

      // Cookie is set by server; auth middleware will use it
      // Redirect to dashboard
      navigate('/dashboard', { replace: true });

      addToast({
        type: 'success',
        message: 'Pilot account created! Welcome to RecoverAI.',
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to start pilot',
      });
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading audit...</p>
        </div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Audit not found</p>
        </div>
      </div>
    );
  }

  const { analysis } = audit;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Your Cash Operations Opportunity
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Based on your Stripe data (48-hour analysis)
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${analysis.total.total.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Working Capital Freed
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${analysis.ar.total_overdue.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Overdue Invoices
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {analysis.dso.current_dso}d
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Current DSO
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {analysis.total.roi}x
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Projected ROI
            </div>
          </div>
        </div>

        {/* AR Recovery Breakdown */}
        <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Recovery Opportunity by Aging
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Stage</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Invoices</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Amount</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Recovery %</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Est. Recovery</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(analysis.ar.by_stage).map(([stage, data]: any) => (
                  <tr key={stage} className="border-b border-gray-200 dark:border-white/[0.06]">
                    <td className="py-3 px-4 text-gray-900 dark:text-white">
                      {stage === 'stage1' && '30-60 days'}
                      {stage === 'stage2' && '60-90 days'}
                      {stage === 'stage3' && '90-120 days'}
                      {stage === 'stage4' && '120+ days'}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">{data.count}</td>
                    <td className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">
                      ${data.amount.toLocaleString()}
                    </td>
                    <td className="text-right py-3 px-4 text-gray-700 dark:text-gray-300">
                      {Math.round(data.recovery_rate * 100)}%
                    </td>
                    <td className="text-right py-3 px-4 font-bold text-gray-900 dark:text-white">
                      ${Math.round(data.amount * data.recovery_rate).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* DSO Analysis */}
        <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            DSO Analysis: You're Slower Than Peers
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your DSO</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {analysis.dso.current_dso}d
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Industry Benchmark</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {analysis.dso.benchmark_dso}d
              </div>
            </div>
            
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gap Cost</div>
              <div className="text-3xl font-bold text-red-600">
                +${analysis.dso.working_capital_freed.toLocaleString()}
              </div>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-6">
            You're collecting payment {analysis.dso.gap} days slower than industry peers. 
            This costs you ${analysis.dso.working_capital_freed.toLocaleString()} in 
            working capital that could be reinvested.
          </p>
        </div>

        {/* Sample Invoices */}
        <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            Sample Overdue Invoices
          </h2>
          
          <div className="space-y-3">
            {analysis.ar.previews.slice(0, 5).map((inv: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center border-b border-gray-200 dark:border-white/[0.06] pb-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{inv.customer_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{inv.daysOverdue} days overdue</p>
                </div>
                <p className="font-bold text-gray-900 dark:text-white">
                  ${inv.amount.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="space-y-4">
          <Button
            variant="primary"
            size="lg"
            onClick={() => setShowUpgradeModal(true)}
            className="w-full"
          >
            Start 14-Day Pilot (Free)
          </Button>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              <strong>Here's what happens:</strong> You'll see real dunning emails being sent,
               payment plans auto-generated, and live recovery numbers. 
              If we hit 30%+ recovery (matching this forecast), 
              we'll discuss $2.5K + 1% recovery pricing. No credit card needed.
            </p>
          </div>
        </div>

        {/* Upgrade Modal */}
        <Modal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          size="md"
          title="Start your 14-day pilot"
        >
          <div className="space-y-6">
            {/* Steps */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Shadow mode (first 48h)
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    All dunning emails staged for your review before sending
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Review first batch
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    See drafts, approve, or reject before customers see them
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Go live when ready
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Switch to auto mode or stay in shadow mode as long as you want
                  </p>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200">
                <strong>Login email will be sent to:</strong> {audit?.email}
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-2">
                You'll receive a temporary password. Change it immediately on first login.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1"
              >
                Not yet
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleConvertToPilot}
                loading={converting}
                disabled={converting}
                className="flex-1"
              >
                Yes, start pilot
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default AuditResults;

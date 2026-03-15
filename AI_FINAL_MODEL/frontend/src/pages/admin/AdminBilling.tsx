import { useQuery } from '@tanstack/react-query';
import axios from '../../config/axios';
import { ExternalLink, Check, Zap } from 'lucide-react';
import { useToast } from '../../components/ui/Toast';

const PLANS = [
  {
    tier: 'free',
    name: 'Free',
    price: '$0',
    color: 'text-slate-400',
    border: 'border-slate-700',
    features: ['1 repository', '50 PRs/month', '30 days history', '3 team members', 'GitHub bot'],
  },
  {
    tier: 'starter',
    name: 'Starter',
    price: '$199',
    color: 'text-blue-400',
    border: 'border-blue-500/40',
    features: ['1 repository', 'Unlimited PRs', '90 days history', '10 team members', 'GitHub bot + Dashboard'],
  },
  {
    tier: 'professional',
    name: 'Professional',
    price: '$599',
    color: 'text-indigo-400',
    border: 'border-indigo-500/40',
    popular: true,
    features: ['5 repositories', 'Unlimited PRs', 'Full history', 'Unlimited team', 'Engineering Health'],
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    price: '$1,499',
    color: 'text-yellow-400',
    border: 'border-yellow-500/40',
    features: ['Unlimited repos', 'Unlimited PRs', 'Full history', 'Priority support', 'SLA guarantee'],
  },
];

export default function AdminBilling() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: () => axios.get('/api/billing/plan').then(r => r.data),
  });

  const { data: checkoutData } = useQuery({
    queryKey: ['checkout-urls'],
    queryFn: () => axios.get('/api/billing/checkout-urls').then(r => r.data),
  });

  const handlePortal = async () => {
    const res = await axios.get('/api/billing/portal');
    window.open(res.data.url, '_blank');
  };

  if (isLoading) return <div className="text-slate-400 py-8">Loading billing...</div>;
  if (!data) return null;

  const { subscription: sub, usage, plan } = data;
  const currentTier = sub.tier;
  const maxDisplay = plan.maxPRsPerMonth === Infinity ? '∞' : plan.maxPRsPerMonth;
  const usagePct = plan.maxPRsPerMonth !== Infinity
    ? Math.min((usage.prs_analyzed / plan.maxPRsPerMonth) * 100, 100)
    : 0;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-6">Billing & Subscription</h1>

      {/* Current status */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-slate-400 text-sm">Current Plan</p>
            <p className="text-white font-bold text-xl mt-0.5 capitalize">{currentTier}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2 py-1 rounded-full border ${
              sub.status === 'active'
                ? 'text-green-400 bg-green-500/10 border-green-500/20'
                : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}>
              {sub.status}
            </span>
            {sub.tier !== 'free' && (
              <button
                onClick={handlePortal}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors text-sm"
              >
                <ExternalLink size={13} />Manage
              </button>
            )}
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-slate-400 text-sm">PRs Analyzed This Month</span>
            <span className="text-white text-sm font-medium">{usage.prs_analyzed} / {maxDisplay}</span>
          </div>
          {plan.maxPRsPerMonth !== Infinity && (
            <div className="bg-slate-700 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${usagePct > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          )}
        </div>

        {sub.current_period_end && (
          <p className="text-slate-600 text-xs mt-3">
            Next billing: {new Date(sub.current_period_end).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Plan comparison */}
      <h2 className="text-white font-semibold mb-4">
        {currentTier === 'free' ? 'Upgrade Your Plan' : 'Available Plans'}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {PLANS.map(p => {
          const isCurrent = p.tier === currentTier;
          const checkoutUrl = checkoutData?.[p.tier as keyof typeof checkoutData];

          return (
            <div
              key={p.tier}
              className={`relative bg-slate-800 border rounded-xl p-4 flex flex-col transition-all ${
                isCurrent ? `${p.border} ring-1 ring-inset` : 'border-slate-700'
              }`}
            >
              {p.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                  POPULAR
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-2.5 right-3 text-[10px] font-bold bg-green-600 text-white px-2 py-0.5 rounded-full">
                  CURRENT
                </span>
              )}

              <p className={`font-bold text-sm mb-1 ${p.color}`}>{p.name}</p>
              <p className="text-white text-2xl font-bold mb-0.5">{p.price}</p>
              <p className="text-slate-600 text-xs mb-4">/month</p>

              <ul className="space-y-1.5 flex-1 mb-4">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-slate-400">
                    <Check size={11} className="text-green-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="text-center text-slate-600 text-xs py-1.5">Current plan</div>
              ) : p.tier === 'free' ? (
                <div className="text-center text-slate-600 text-xs py-1.5">Downgrade via portal</div>
              ) : (
                <button
                  onClick={() => {
                    if (currentTier !== 'free') {
                      handlePortal();
                    } else if (checkoutUrl) {
                      window.open(checkoutUrl, '_blank');
                    } else {
                      toast('Checkout URL not configured for this plan.', 'error');
                    }
                  }}
                  className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    p.tier === 'professional'
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  }`}
                >
                  <Zap size={11} />
                  {currentTier !== 'free' ? 'Change Plan' : 'Upgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

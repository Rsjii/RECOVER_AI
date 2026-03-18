import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useTheme } from '../hooks/useTheme';

const PLANS = [
  {
    name: 'Starter',
    monthlyPrice: '$499',
    annualPrice: '$399',
    period: '/mo',
    fee: '+ 1% success fee',
    desc: 'For growing SaaS teams starting their AR recovery journey.',
    users: 'Up to 3 users',
    invoices: 'Up to 300 invoices/mo',
    features: [
      'Stripe integration',
      'AI dunning emails (5 per invoice)',
      'Risk scoring (0-100)',
      'Basic dashboard',
      'Slack alerts',
      'Email support',
    ],
    cta: 'Start free trial',
    popular: false,
  },
  {
    name: 'Growth',
    monthlyPrice: '$999',
    annualPrice: '$799',
    period: '/mo',
    fee: '+ 0.75% success fee',
    desc: 'For scaling teams with high invoice volume and complex workflows.',
    users: 'Up to 15 users',
    invoices: 'Unlimited invoices',
    features: [
      'Everything in Starter',
      'QuickBooks + Chargebee integrations',
      'Payment plan automation',
      'Advanced analytics & DSO tracking',
      'Team collaboration + RBAC',
      'Policy rules & approval queues',
      'Priority support',
    ],
    cta: 'Start free trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    monthlyPrice: 'Custom',
    annualPrice: 'Custom',
    period: '',
    fee: '+ 0.5% success fee',
    desc: 'For large finance teams needing custom integrations and SLAs.',
    users: 'Unlimited users + SSO',
    invoices: 'Unlimited invoices',
    features: [
      'Everything in Growth',
      'Custom integrations (NetSuite, SAP, Zuora)',
      'Dedicated account manager',
      'Custom dunning playbooks',
      'SLA guarantees',
      'GDPR DPA + SOC 2 report',
      'White-label emails',
      'API access',
    ],
    cta: 'Contact sales',
    popular: false,
  },
];

const RoiCalculator: React.FC = () => {
  const [ar, setAr] = useState('');
  const arNum = parseFloat(ar.replace(/,/g, '')) || 0;
  const recoveryLow = Math.round(arNum * 0.20);
  const recoveryHigh = Math.round(arNum * 0.35);
  const feeLow = Math.round(recoveryLow * 0.01);
  const feeHigh = Math.round(recoveryHigh * 0.01);
  const netLow = recoveryLow - feeLow - 499;
  const netHigh = recoveryHigh - feeHigh - 499;
  const hasResult = arNum > 0;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-8 text-center">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">How much could you recover?</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter your monthly overdue AR to see your estimated ROI</p>
      <div className="flex items-center gap-2 max-w-xs mx-auto mb-6">
        <span className="text-gray-500 text-lg">$</span>
        <input
          type="text"
          value={ar}
          onChange={(e) => setAr(e.target.value.replace(/[^0-9,]/g, ''))}
          placeholder="50,000"
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-500 text-sm">/mo</span>
      </div>
      {hasResult && (
        <div className="grid grid-cols-3 gap-4 text-left">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 mb-1">Estimated recovery</p>
            <p className="text-xl font-bold text-green-600">${recoveryLow.toLocaleString()} – ${recoveryHigh.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">20–35% of overdue AR</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 mb-1">Your total cost</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">${(499 + feeLow).toLocaleString()} – ${(499 + feeHigh).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">$499 base + 1% success fee</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-blue-300 dark:border-blue-700">
            <p className="text-xs text-gray-500 mb-1">Your net gain</p>
            <p className="text-xl font-bold text-blue-600">${netLow.toLocaleString()} – ${netHigh.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">after all fees</p>
          </div>
        </div>
      )}
    </div>
  );
};

const Pricing: React.FC = () => {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');
  const { theme, toggleTheme } = useTheme();

  useEffect(() => { document.title = 'Pricing — RecoverAI'; }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Nav */}
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link to="/landing" className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">R</span>
          </div>
          RecoverAI
        </Link>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme}
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
            {theme === 'light' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.536l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" /></svg>
            )}
          </button>
          <Link to="/login" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900">Sign in</Link>
          <Link to="/signup"><Button size="sm">Start free trial</Button></Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-14 pb-10 text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
          Simple, outcome-aligned pricing
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Pay a base subscription + a small fee only on invoices we successfully recover.
          If we don't recover anything, you pay just the base.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm px-4 py-2 rounded-full">
          21-day free trial on all plans. No credit card required.
        </div>

        {/* Billing toggle */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              billingInterval === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('annual')}
            className={`px-4 py-2 rounded-lg font-medium transition relative ${
              billingInterval === 'annual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            Annual
            {billingInterval === 'annual' && (
              <span className="ml-2 inline-block bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 text-xs px-2 py-0.5 rounded">
                Save 20%
              </span>
            )}
          </button>
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const displayPrice = billingInterval === 'monthly' ? plan.monthlyPrice : plan.annualPrice;
            const billedText = billingInterval === 'annual' ? ' billed annually' : '';
            return (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 flex flex-col ${
                plan.popular
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-100 dark:shadow-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plan.desc}</p>
              </div>

              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">{displayPrice}</span>
                <span className="text-gray-500 text-sm">{plan.period}</span>
                {billingInterval === 'annual' && displayPrice !== 'Custom' && (
                  <div className="text-xs text-gray-500 mt-1">{billedText}</div>
                )}
              </div>
              <p className="text-sm text-blue-600 font-medium mb-1">{plan.fee}</p>
              <p className="text-xs text-gray-500 mb-6">{plan.users} · {plan.invoices}</p>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link to={plan.name === 'Enterprise' ? 'mailto:sales@recoverai.com' : '/signup'}>
                <Button
                  className="w-full"
                  variant={plan.popular ? 'primary' : 'outline'}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
            );
          })}
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <RoiCalculator />
      </section>

      {/* Success fee explainer */}
      <section className="bg-gray-50 dark:bg-gray-800/50 py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            How does the success fee work?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            We charge 1% only on invoices that RecoverAI successfully recovers.
            Zero recovery = zero success fee. Aligned incentives.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            {[
              { label: 'You owe', amount: '$0', desc: 'If we recover $0 this month' },
              { label: 'You pay $250', amount: '$25k', desc: 'If we recover $25,000 (1%)' },
              { label: 'You pay $500', amount: '$50k', desc: 'If we recover $50,000 (1%)' },
            ].map((ex) => (
              <div key={ex.label} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 mb-1">{ex.desc}</p>
                <p className="text-2xl font-bold text-blue-600">{ex.amount}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{ex.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">Pricing FAQ</h2>
        <div className="space-y-3">
          {[
            {
              q: 'What counts as a "successful recovery"?',
              a: 'An invoice is counted as recovered when payment is confirmed in Stripe, QuickBooks, or Chargebee — directly as a result of RecoverAI\'s outreach. We track attribution via email click + payment within 30 days.',
            },
            {
              q: 'What happens after the free trial?',
              a: 'After 14 days, you can choose a plan or your account pauses. No charges until you upgrade. All your data is preserved for 30 days.',
            },
            {
              q: 'Can I change plans later?',
              a: 'Yes, upgrade or downgrade anytime. Upgrades are immediate; downgrades take effect at the next billing cycle.',
            },
            {
              q: 'Is there a setup fee?',
              a: 'No setup fees, ever. Stripe connects in 60 seconds, QuickBooks and Chargebee in under 2 minutes.',
            },
            {
              q: 'Do you offer annual billing discounts?',
              a: 'Yes, annual plans get 2 months free (equivalent to 17% off). Contact us to switch.',
            },
          ].map((item) => (
            <details key={item.q} className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <summary className="flex items-center justify-between cursor-pointer font-medium text-gray-900 dark:text-white list-none text-sm">
                {item.q}
                <svg className="w-4 h-4 text-gray-400 group-open:rotate-180 transition-transform flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-12">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Start recovering invoices today</h2>
          <p className="text-blue-100 mb-6">14-day free trial. No credit card. Cancel anytime.</p>
          <Link to="/signup">
            <Button className="bg-white text-blue-600 hover:bg-blue-50 px-8" size="lg">
              Start free trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <Link to="/landing" className="text-white font-bold flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-xs">R</div>
            RecoverAI
          </Link>
          <div className="flex gap-4 text-sm">
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/privacy" className="hover:text-white">Privacy</Link>
            <Link to="/security" className="hover:text-white">Security</Link>
            <Link to="/dpa" className="hover:text-white">DPA</Link>
          </div>
          <p className="text-xs">2026 RecoverAI.</p>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;

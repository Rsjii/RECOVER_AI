import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ui/ThemeToggle';

const PLANS = [
  {
    name: 'Free Trial',
    monthlyPrice: '$0',
    annualPrice: '$0',
    period: '',
    fee: 'No credit card required',
    feeDetail: '21 days · full Growth features',
    desc: 'Try RecoverAI risk-free for 21 days with all Growth plan features.',
    users: 'Up to 5 users',
    invoices: 'Unlimited invoices',
    features: [
      'Full Growth features for 21 days',
      'AI dunning emails + SMS reminders',
      'Payment failure prediction',
      '90-day cash position forecast',
      'Stripe + QuickBooks integration',
      'Email open/click tracking',
      'No credit card required',
    ],
    cta: 'Start free trial',
    popular: false,
  },
  {
    name: 'Growth',
    monthlyPrice: '$2,500',
    annualPrice: '$2,000',
    period: '/mo',
    fee: '+ tiered success fee',
    feeDetail: '5% first $50k · 3% next $100k · 2% above',
    desc: 'For $5M–$20M ARR B2B SaaS with invoice-based billing.',
    users: 'Up to 20 users',
    invoices: 'Unlimited invoices',
    features: [
      'AI dunning emails + SMS reminders',
      'Payment failure prediction (5 signals)',
      '90-day cash position forecast',
      'Payment plans (3/6/12 month)',
      'Stripe + QuickBooks integration',
      'Email open/click tracking',
      'CAN-SPAM compliant unsubscribe',
      'Priority email support',
    ],
    cta: 'Start free trial',
    popular: true,
  },
  {
    name: 'Enterprise',
    monthlyPrice: '$5,000',
    annualPrice: '$4,000',
    period: '/mo',
    fee: '+ tiered success fee',
    feeDetail: '4% first $100k · 2.5% next $200k · 1.5% above',
    desc: 'For $20M–$100M ARR companies needing full finance ops automation.',
    users: 'Unlimited users + SSO',
    invoices: 'Unlimited invoices',
    features: [
      'Everything in Growth +',
      'Basic AP automation (invoice OCR + approval)',
      'Stripe + QuickBooks + Xero + NetSuite',
      '180-day cash position + scenario planning',
      'Advanced payment prediction (all 5 signals)',
      'API access + white-label option',
      'Dedicated account manager',
      'Monthly CFO review call',
      'Custom email templates',
    ],
    cta: 'Contact sales',
    popular: false,
  },
];

function calcTieredFee(amount: number): number {
  if (amount <= 0) return 0;
  if (amount <= 50000) return Math.round(amount * 0.05);
  if (amount <= 150000) return Math.round(50000 * 0.05 + (amount - 50000) * 0.03);
  return Math.round(50000 * 0.05 + 100000 * 0.03 + (amount - 150000) * 0.02);
}

const RoiCalculator: React.FC = () => {
  const [ar, setAr] = useState('');
  const arNum = parseFloat(ar.replace(/,/g, '')) || 0;
  const recoveryLow = Math.round(arNum * 0.20);
  const recoveryHigh = Math.round(arNum * 0.35);
  const feeLow = calcTieredFee(recoveryLow);
  const feeHigh = calcTieredFee(recoveryHigh);
  const BASE = 2500;
  const netLow = recoveryLow - feeLow - BASE;
  const netHigh = recoveryHigh - feeHigh - BASE;
  const hasResult = arNum > 0;

  return (
    <div className="bg-brand-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-8 text-center">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">How much could you recover?</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter your monthly overdue AR to see your estimated ROI</p>
      <div className="flex items-center gap-2 max-w-xs mx-auto mb-6">
        <span className="text-gray-500 text-lg">$</span>
        <input
          type="text"
          value={ar}
          onChange={(e) => setAr(e.target.value.replace(/[^0-9,]/g, ''))}
          placeholder="50,000"
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-[#111113] text-gray-900 dark:text-white text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-500 text-sm">/mo</span>
      </div>
      {hasResult && (
        <div className="grid grid-cols-3 gap-4 text-left">
          <div className="bg-white dark:bg-[#111113] rounded-xl p-4 border border-gray-200 dark:border-white/[0.06]">
            <p className="text-xs text-gray-500 mb-1">Estimated recovery</p>
            <p className="text-xl font-bold text-green-600">${recoveryLow.toLocaleString()} – ${recoveryHigh.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">20–35% of overdue AR</p>
          </div>
          <div className="bg-white dark:bg-[#111113] rounded-xl p-4 border border-gray-200 dark:border-white/[0.06]">
            <p className="text-xs text-gray-500 mb-1">Your total cost</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">${(BASE + feeLow).toLocaleString()} – ${(BASE + feeHigh).toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">$2,500 base + tiered success fee</p>
          </div>
          <div className="bg-white dark:bg-[#111113] rounded-xl p-4 border border-blue-300 dark:border-blue-700">
            <p className="text-xs text-gray-500 mb-1">Your net gain</p>
            <p className="text-xl font-bold text-brand-600">${netLow.toLocaleString()} – ${netHigh.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">after all fees</p>
          </div>
        </div>
      )}
    </div>
  );
};

const Pricing: React.FC = () => {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => { document.title = 'Pricing — RecoverAI'; }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b]">
      {/* Nav */}
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link to="/landing" className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">R</span>
          </div>
          RecoverAI
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
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
        <div className="mt-4 inline-flex items-center gap-2 bg-brand-50 dark:bg-blue-900/30 text-brand-700 dark:text-blue-300 text-sm px-4 py-2 rounded-full">
          21-day free trial on all plans. No credit card required.
        </div>

        {/* Billing toggle */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => setBillingInterval('monthly')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              billingInterval === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-[#111113] text-gray-900 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('annual')}
            className={`px-4 py-2 rounded-lg font-medium transition relative ${
              billingInterval === 'annual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-[#111113] text-gray-900 dark:text-gray-300 hover:bg-gray-200'
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
                  ? 'border-blue-500 bg-brand-50 dark:bg-blue-900/20 shadow-lg shadow-blue-100 dark:shadow-blue-900/20'
                  : 'border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#111113]'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
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
              <p className="text-sm text-brand-600 font-medium mb-1">{plan.fee}</p>
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
      <section className="bg-gray-50 dark:bg-[#111113]/50 py-12">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            How does the success fee work?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            We charge a tiered success fee only on invoices RecoverAI successfully recovers.
            Zero recovery = zero success fee. Rates drop as you recover more — aligned incentives.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            {[
              { label: 'You owe $0 success fee', amount: '$0', desc: 'If we recover $0 this month' },
              { label: 'You pay $1,250 (5%)', amount: '$25k', desc: 'If we recover $25,000' },
              { label: 'You pay $2,500 (5%)', amount: '$50k', desc: 'If we recover $50,000' },
            ].map((ex) => (
              <div key={ex.label} className="bg-white dark:bg-[#111113] rounded-xl p-5 border border-gray-200 dark:border-white/[0.06]">
                <p className="text-xs text-gray-500 mb-1">{ex.desc}</p>
                <p className="text-2xl font-bold text-brand-600">{ex.amount}</p>
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
              a: 'After 21 days, you can choose a plan or your account pauses. No charges until you upgrade. All your data is preserved for 30 days.',
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
              a: 'Yes, annual plans save 20% when you pay annually. Contact us to switch plans.',
            },
          ].map((item) => (
            <details key={item.q} className="group bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
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
      <section className="bg-brand-600 py-12">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Start recovering invoices today</h2>
          <p className="text-blue-100 mb-6">21-day free trial. No credit card. Cancel anytime.</p>
          <Link to="/signup">
            <Button className="bg-white text-brand-600 hover:bg-brand-50 px-8" size="lg">
              Start free trial
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 py-8 border-t border-gray-200 dark:border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <Link to="/landing" className="text-gray-900 dark:text-white font-bold flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-xs text-white">R</div>
            RecoverAI
          </Link>
          <div className="flex gap-4 text-sm">
            <Link to="/terms" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Terms</Link>
            <Link to="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Privacy</Link>
            <Link to="/security" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Security</Link>
            <Link to="/dpa" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">DPA</Link>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">2026 RecoverAI.</p>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;

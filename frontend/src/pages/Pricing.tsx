import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ui/ThemeToggle';

const Pricing: React.FC = () => {
  useEffect(() => {
    document.title = 'Pricing — RecoverAI';
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b]">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900 dark:text-white">RecoverAI</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/signup">
              <Button>Start free trial</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-20 space-y-20">
        {/* Hero */}
        <section className="text-center space-y-6">
          <div>
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              Pricing Plans for Every Business
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Custom pricing based on your company size and recovery needs. We're only successful when you are.
            </p>
          </div>
        </section>

        {/* Value Proposition */}
        <section className="bg-gray-50 dark:bg-white/[0.03] rounded-3xl border border-gray-200 dark:border-white/[0.06] p-12 space-y-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Aligned Incentives</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
              We work on a hybrid model: a base subscription fee for access to our platform, plus a success fee on what we recover. This means we profit when you profit, and we're genuinely incentivized to maximize your results.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div className="space-y-3">
                <span className="text-3xl">📅</span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Subscription Fee</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Monthly platform access including all core features, support, and integrations
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-3xl">💰</span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Success Fee</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Small percentage of recovered funds. No recovery = no success fee.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What's Included */}
        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center">What's Included</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Core Features</h3>
              <ul className="space-y-3">
                {[
                  'AI-powered dunning emails (5 stages)',
                  'SMS dunning + payment prediction',
                  'Behavioral segmentation (4 tiers)',
                  'Stripe + QuickBooks sync',
                  '90-day cash flow forecasting',
                  'Attribution & ROI reporting',
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-gray-600 dark:text-gray-400">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Growth Plan+</h3>
              <ul className="space-y-3">
                {[
                  'Everything in Core, plus:',
                  'Voice calling (Tier 4 customers)',
                  'Auto-generated payment plans',
                  'Real-time DTMF/IVR handling',
                  'Advanced attribution tracking',
                  'Dedicated account support',
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-gray-600 dark:text-gray-400">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-8 max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center">Common Questions</h2>

          <div className="space-y-6">
            {[
              {
                q: "How is pricing determined?",
                a: "We customize pricing based on your company size, ARR, and recovery goals. Schedule a demo to discuss your specific situation.",
              },
              {
                q: "Can I negotiate terms?",
                a: "Yes. We work with all customers to find mutually beneficial pricing. Higher recovery volumes often come with better rates.",
              },
              {
                q: "What if I don't recover anything?",
                a: "You pay the subscription fee only. No recovery = no success fee. We're incentivized to help you succeed.",
              },
              {
                q: "Is there a free trial?",
                a: "Yes. 21-day free trial with full platform access (no credit card required). Experience the full value before committing.",
              },
              {
                q: "Do you offer annual discounts?",
                a: "Yes. Annual plans typically include 15–20% savings. Contact sales to discuss annual pricing.",
              },
            ].map((item, i) => (
              <div key={i} className="border-b border-gray-200 dark:border-white/[0.06] pb-6 last:border-b-0">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{item.q}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center space-y-6 py-12 border-t border-gray-200 dark:border-white/[0.06]">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Get Custom Pricing</h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            We'll work with you to create a plan that aligns with your business goals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="mailto:hello@recoverai.com">
              <Button size="lg">Schedule a demo</Button>
            </a>
            <Link to="/signup">
              <Button variant="outline" size="lg">
                Start free trial
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02] mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© 2026 RecoverAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;

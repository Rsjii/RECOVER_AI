import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ui/ThemeToggle';

const Pricing: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Pricing — RecoverAI';
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b]">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900 dark:text-white">RecoverAI</span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Button onClick={() => navigate('/signup')}>Become a Pilot</Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-20 space-y-20">
        {/* Hero */}
        <section className="text-center space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              How It Works
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Free 3-week trial. See results. Then we discuss what's next for your business.
            </p>
          </div>
        </section>

        {/* Value Proposition */}
        <section className="bg-gray-50 dark:bg-white/[0.03] rounded-3xl border border-gray-200 dark:border-white/[0.06] p-6 sm:p-12 space-y-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Your Journey</h2>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-8">
              We only win when you recover more. That's why we start with a free trial—so you see the results before any commitment.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="space-y-3">
                <span className="text-3xl">🆓</span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Week 1-3: Free Trial</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Full access. No credit card. I set everything up for you. See your results in action.
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-3xl">✨</span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Day 14: Results</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  See how much we recovered. See how much time you saved. Real numbers, real impact.
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-3xl">💬</span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Next Steps</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Based on your results, let's discuss how RecoverAI can become part of your recovery strategy.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* What's Included */}
        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center">What You Get</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">During Trial</h3>
              <ul className="space-y-3">
                {[
                  'AI-powered dunning emails',
                  'Personalized per customer',
                  'Automated invoice tracking',
                  'Payment notifications',
                  'Risk scoring dashboard',
                  'Cash position forecasting',
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-gray-600 dark:text-gray-400">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Plus (If You Pay)</h3>
              <ul className="space-y-3">
                {[
                  'SMS dunning (higher response rates)',
                  'Voice calling (Tier 4 customers)',
                  'Payment plans (auto-generated)',
                  'Advanced segmentation',
                  'Custom reporting',
                  'Priority support',
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
                q: "Is the 2-week trial really free?",
                a: "Yes. Completely free. No credit card required. No setup fees. I'll personally set everything up for you.",
              },
              {
                q: "What happens after 3 weeks?",
                a: "You'll see real results—how much we recovered, how many invoices we processed, how much time you saved. Then we discuss what makes sense for your business.",
              },
              {
                q: "What if I don't want to pay after the trial?",
                a: "That's fine. No obligation. You can cancel anytime.",
              },
              {
                q: "What happens after the free trial?",
                a: "After your trial ends, we'll review your results together and discuss how RecoverAI fits your recovery strategy. Custom pricing is based on your specific needs.",
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. Month-to-month. Cancel anytime, no questions asked.",
              },
              {
                q: "Can I upgrade features mid-trial?",
                a: "Yes. If you need additional features during your trial, just let us know and we'll enable them for free.",
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
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Ready to Recover More?</h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Get 3 weeks free. See your results. Then we'll talk about what's next.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/signup')}>Become a Pilot</Button>
            <a href="mailto:hello@recoverai.com">
              <Button variant="outline" size="lg">
                Contact Sales
              </Button>
            </a>
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

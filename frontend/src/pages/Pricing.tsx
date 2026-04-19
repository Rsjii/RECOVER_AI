import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useSEO } from '../hooks/useSEO';
import { getPageSEO } from '../lib/seoConfig';
import { PublicFooter } from '../components/layout/PublicFooter';

const Pricing: React.FC = () => {
  const navigate = useNavigate();

  // SEO configuration
  useSEO(getPageSEO('pricing'));

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
            <Button onClick={() => navigate('/signup')}>Start Free Trial</Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-20 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-6">
          <div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
              Pricing
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Free 21-day trial. See real results. Then we discuss pricing that makes sense for you.
            </p>
          </div>
        </section>

        {/* Main Message */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-3xl border border-blue-200 dark:border-blue-800/30 p-8 sm:p-12 space-y-8">
          <div className="max-w-2xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Custom Pricing Based on Your Metrics
            </h2>

            <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
              We don't show pricing before you see the agent work. Here's why:
            </p>

            <div className="space-y-4 text-left max-w-xl mx-auto">
              <div className="flex gap-3">
                <span className="text-2xl flex-shrink-0">📉</span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">DSO improvement is your baseline</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">See how much your days to payment drop (15-25 days). That's the core value.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="text-2xl flex-shrink-0">⏱️</span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Ops time saved is quantified</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Track hours freed up: most teams save 15-20 hours/month on dunning work.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="text-2xl flex-shrink-0">💡</span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Company size and AR volume matter</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">A $500K AR agency pays differently than $2M AR shop. Pricing scales with value.</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-blue-200 dark:border-blue-800/50">
              <p className="text-gray-700 dark:text-gray-300 mb-6">
                <strong>Try the agent for free.</strong> Measure DSO improvement and hours saved. Then let's talk pricing based on YOUR metrics.
              </p>
              <Button size="lg" onClick={() => navigate('/signup')} className="w-full sm:w-auto">
                Start Your Free Trial
              </Button>
            </div>
          </div>
        </section>

        {/* Trial Details */}
        <section className="space-y-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white text-center">Your 21-Day Trial Includes</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: '🤖', title: 'Full Autonomous Agent', desc: 'AI analyzes AR, sends personalized dunning emails automatically 24/7' },
              { icon: '📉', title: 'DSO Tracking Dashboard', desc: 'Watch your days to payment drop daily. Measure exact improvement.' },
              { icon: '⏱️', title: 'Hours Saved Metrics', desc: 'See exactly how many hours your ops team freed up each day' },
              { icon: '📞', title: 'Personal Setup Call', desc: 'I help you connect Stripe or CSV, show dashboard, answer questions' },
              { icon: '🔄', title: 'Full Integrations', desc: 'Stripe + CSV import. Agent analyzes all invoice and payment data' },
              { icon: '📊', title: 'Daily Reports', desc: 'Track DSO improvement, hours saved, customer payment behavior insights' },
            ].map((item, i) => (
              <div key={i} className="bg-gray-50 dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <section className="space-y-8 bg-gray-50 dark:bg-white/[0.02] rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">Your 21-Day Timeline</h2>

          <div className="space-y-6 max-w-2xl mx-auto">
            {[
              {
                day: 'Day 1',
                title: 'Setup (30 min)',
                desc: 'Connect Stripe or upload CSV. Dashboard ready. DSO baseline measured.',
              },
              {
                day: 'Days 2-7',
                title: 'Agent Starts Work',
                desc: 'Agent analyzes AR, sends personalized dunning emails. You see DSO dropping.',
              },
              {
                day: 'Days 8-14',
                title: 'Check-in Call',
                desc: 'I call you. Review DSO improvement. Measure hours saved. Answer questions.',
              },
              {
                day: 'Days 15-21',
                title: 'Final Metrics',
                desc: 'Full report: DSO drop (target 15-25 days), hours freed (target 15-20/month).',
              },
              {
                day: 'Day 21',
                title: 'Pricing Discussion',
                desc: 'Based on YOUR metrics (DSO + hours saved), we discuss custom pricing.',
              },
            ].map((item, i) => (
              <div key={i} className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-10 w-20 rounded-lg bg-blue-600 text-white font-semibold text-sm">
                    {item.day}
                  </div>
                </div>
                <div className="flex-grow">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{item.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-8 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">Questions?</h2>

          <div className="space-y-6">
            {[
              {
                q: 'Is the trial really free?',
                a: 'Yes. Completely free. No credit card required. Full access to the autonomous agent and all metrics.',
              },
              {
                q: 'What if I don\'t see DSO improvement?',
                a: 'DSO improves when the agent sends emails systematically. Most agencies see 10-15 day drop in first week. If not, we troubleshoot together.',
              },
              {
                q: 'How does pricing work after the trial?',
                a: 'We discuss custom pricing based on: your company size, current AR volume, and measured DSO improvement + hours saved. No fixed tiers, transparent logic.',
              },
              {
                q: 'Can I pause or cancel anytime?',
                a: 'Yes. Month-to-month. Pause the agent anytime, cancel anytime. No long contracts.',
              },
              {
                q: 'What if the agent sends emails I don\'t like?',
                a: 'You have full control. Pause the agent, review emails before send, or set tone preference (friendly/neutral/aggressive). It\'s your decision.',
              },
            ].map((item, i) => (
              <div key={i} className="border-b border-gray-200 dark:border-white/[0.06] pb-6 last:border-b-0">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{item.q}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center space-y-6 py-12 border-t border-gray-200 dark:border-white/[0.06]">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Ready to optimize your AR?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Free 21-day trial. See 15-25 day DSO improvement. No credit card.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/signup')}>
              Start Free Trial
            </Button>
            <a href="mailto:hello@recoverai.tech">
              <Button variant="outline" size="lg">
                Questions? Email Us
              </Button>
            </a>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Free trial. No credit card required. Cancel anytime.
          </p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};

export default Pricing;

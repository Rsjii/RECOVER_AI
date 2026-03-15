import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, setAuthState } = useAuth();
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    document.title = 'RecoverAI — Autonomous AR Recovery for B2B SaaS';
    // Auto-redirect authenticated users to dashboard
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  /**
   * Demo login handler
   * For unauthenticated users: Create demo account + navigate to dashboard
   * For authenticated users: Just navigate to dashboard (they're already authenticated)
   */
  const handleTryDemo = async () => {
    setDemoLoading(true);
    try {
      // Only call demo endpoint if not authenticated
      if (!isAuthenticated) {
        const response: any = await api.post('/api/demo/login');
        // Update auth context directly from response (don't call refresh)
        if (response.user && response.company) {
          setAuthState(response.user, response.company);
        }
      }
      navigate('/dashboard');
    } catch (error) {
      setDemoLoading(false);
      console.error('Demo login failed:', error);
    }
  };

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
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/pricing" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Pricing</Link>
          <Link to="/security" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Security</Link>
          <Link to="/login" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Sign in</Link>
          <Link to="/signup"><Button size="sm">Start free trial</Button></Link>
        </nav>
        <div className="flex md:hidden gap-2">
          <Link to="/login" className="text-sm text-gray-600">Sign in</Link>
          <Link to="/signup"><Button size="sm">Try free</Button></Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Now live — connect Stripe in under 60 seconds
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white max-w-4xl mx-auto leading-tight">
          Stop chasing invoices.<br />
          <span className="text-blue-600">Let AI recover them.</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          RecoverAI autonomously sends personalized dunning emails, offers payment plans, and tracks payments — without any manual work from your team.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          {!isAuthenticated ? (
            <>
              <Link to="/signup"><Button size="lg" className="px-8">Start 14-day free trial</Button></Link>
              <Button
                size="lg"
                variant="outline"
                className="px-8"
                onClick={handleTryDemo}
                disabled={demoLoading}
              >
                {demoLoading ? 'Loading demo...' : 'Try live demo'}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="lg"
                className="px-8"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-8"
                onClick={handleTryDemo}
              >
                Try demo data
              </Button>
            </>
          )}
        </div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No credit card required. Cancel anytime.</p>
      </main>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: '68%', label: 'Avg recovery rate' },
            { value: '< 1 day', label: 'Time to first recovery' },
            { value: '5-email', label: 'Autonomous dunning sequence' },
            { value: '0 hours', label: 'Manual work needed' },
          ].map((s) => (
            <div key={s.label} className="text-center bg-gray-50 dark:bg-gray-800 rounded-xl p-5">
              <div className="text-2xl font-bold text-blue-600">{s.value}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center mb-10">
          How RecoverAI works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              title: 'Connect your billing tool',
              desc: 'Connect Stripe, QuickBooks, or Chargebee in under 60 seconds. We pull all unpaid invoices automatically.',
              color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600',
            },
            {
              step: '2',
              title: 'AI scores and prioritizes',
              desc: 'Every invoice gets a risk score 0-100 based on days overdue, amount, and customer payment history.',
              color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-600',
            },
            {
              step: '3',
              title: 'Agent recovers autonomously',
              desc: 'RecoverAI sends personalized emails, offers payment plans, and tracks payments — all without human approval.',
              color: 'bg-green-100 dark:bg-green-900/40 text-green-600',
            },
          ].map((item) => (
            <div key={item.step} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center text-lg font-bold mb-4`}>
                {item.step}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 dark:bg-gray-800/50 py-14">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center mb-3">
            Everything you need to recover AR
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-10">Not a tool. An agent that does the work.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: '🤖', title: 'Autonomous Agent', desc: 'Runs every 6 hours, no manual trigger needed. Fully autonomous decision-making.' },
              { icon: '📊', title: 'AI Risk Scoring', desc: 'Claude-powered 0-100 score per invoice. Prioritize high-risk customers first.' },
              { icon: '✉️', title: '5-Email Dunning', desc: 'Personalized emails from friendly reminder to formal escalation — auto-sent.' },
              { icon: '💳', title: 'Payment Plans', desc: 'Auto-offer installment plans based on risk. Customer clicks, Stripe charges automatically.' },
              { icon: '🔗', title: 'Multi-source sync', desc: 'Stripe, QuickBooks, Chargebee, CSV. All invoices in one place.' },
              { icon: '📈', title: 'Recovery Dashboard', desc: 'DSO trend, recovery funnel, risk list. Real-time data, no manual reporting.' },
              { icon: '🔔', title: 'Slack Alerts', desc: 'Daily digest + real-time payment alerts. Know the moment money comes in.' },
              { icon: '🛡️', title: 'Approval Queue', desc: 'Route high-risk actions for human review. Full audit trail for compliance.' },
              { icon: '📋', title: 'GDPR Compliance', desc: 'Built-in data export/delete, RBAC, encrypted credentials. Enterprise-ready.' },
            ].map((f) => (
              <div key={f.title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* vs competition */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center mb-10">
          RecoverAI vs. the alternatives
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 text-gray-500 font-medium w-1/3">Feature</th>
                <th className="py-3 text-blue-600 font-semibold">RecoverAI</th>
                <th className="py-3 text-gray-400 font-medium">Upflow</th>
                <th className="py-3 text-gray-400 font-medium">Growfin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[
                ['Truly autonomous (no approval needed)', true, false, false],
                ['Outcome-based pricing', true, false, false],
                ['SMB-friendly (< 1 day setup)', true, false, false],
                ['AI-personalized emails', true, 'Basic', 'Basic'],
                ['Automatic payment plans', true, false, false],
                ['Stripe + QB + Chargebee', true, 'Stripe only', 'Limited'],
                ['Real-time Slack alerts', true, false, false],
                ['14-day free trial', true, false, false],
              ].map(([feature, us, upflow, growfin]) => (
                <tr key={String(feature)}>
                  <td className="py-3 text-gray-700 dark:text-gray-300">{feature}</td>
                  <td className="py-3 text-center">{us === true ? <span className="text-green-600 font-bold">Yes</span> : <span className="text-blue-600 text-xs">{String(us)}</span>}</td>
                  <td className="py-3 text-center">{upflow === false ? <span className="text-red-400">No</span> : <span className="text-gray-500 text-xs">{String(upflow)}</span>}</td>
                  <td className="py-3 text-center">{growfin === false ? <span className="text-red-400">No</span> : <span className="text-gray-500 text-xs">{String(growfin)}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-gray-50 dark:bg-gray-800/50 py-14">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center mb-10">
            What founders say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote: "RecoverAI recovered $34k in the first two weeks — without us sending a single email manually. This is exactly what autonomous AI should do.",
                name: 'Sarah K.',
                title: 'CEO, B2B SaaS ($3M ARR)',
              },
              {
                quote: "We were spending 8 hours a week chasing payments. Now the agent handles it all. Our DSO dropped from 52 days to 31 days in a month.",
                name: 'Marcus T.',
                title: 'CFO, SaaS Startup ($5M ARR)',
              },
              {
                quote: "The payment plan feature alone is worth it. Customers who would have churned are now paying in installments. Recovery rate went from 40% to 71%.",
                name: 'Priya M.',
                title: 'Founder, FinTech SaaS ($2M ARR)',
              },
            ].map((t) => (
              <div key={t.name} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                <p className="text-gray-600 dark:text-gray-300 text-sm italic mb-4">"{t.quote}"</p>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-14">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center mb-10">
          Frequently asked questions
        </h2>
        <div className="space-y-4">
          {[
            {
              q: 'How does RecoverAI send emails on my behalf?',
              a: 'After you connect your account, RecoverAI uses your company name and branding in all outreach. Customers see emails from your company, not from us. You can review all sent emails in the Activity tab.',
            },
            {
              q: 'What if a customer disputes an invoice?',
              a: 'The agent detects dispute signals and flags the invoice for human review instead of continuing dunning. You get a Slack alert and can handle it manually from the dashboard.',
            },
            {
              q: 'Is my data safe? Where is it stored?',
              a: 'All credentials are encrypted with AES-256-GCM before storage. We never store plaintext API keys. Data is stored in US-based PostgreSQL. We are SOC 2 compliant. See our Security page for details.',
            },
            {
              q: 'Can I review emails before they are sent?',
              a: 'By default, the agent sends autonomously (that\'s the value). You can enable "Approval Mode" in Settings to review and approve each email before sending.',
            },
            {
              q: 'What integrations do you support?',
              a: 'Currently: Stripe, QuickBooks, Chargebee, and manual CSV upload. Xero, NetSuite, and Zuora are on the roadmap.',
            },
            {
              q: 'How does outcome-based pricing work?',
              a: 'You pay a base subscription + 1% of invoices we successfully recover. If we recover $50k this month, you pay your base + $500. If we recover nothing, you just pay the base.',
            },
          ].map((item) => (
            <details key={item.q} className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <summary className="flex items-center justify-between cursor-pointer font-medium text-gray-900 dark:text-white list-none">
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
      <section className="bg-blue-600 py-14">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Ready to stop chasing invoices?
          </h2>
          <p className="text-blue-100 mb-8">Connect Stripe in 60 seconds. First recovery in 24 hours. 14-day free trial.</p>
          <Link to="/signup">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 px-10">
              Start free trial — no credit card
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-white font-bold">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-xs">R</div>
              RecoverAI
            </div>
            <div className="flex flex-wrap gap-4 text-sm justify-center">
              <Link to="/pricing" className="hover:text-white">Pricing</Link>
              <Link to="/security" className="hover:text-white">Security</Link>
              <Link to="/terms" className="hover:text-white">Terms</Link>
              <Link to="/privacy" className="hover:text-white">Privacy</Link>
              <Link to="/cookie-policy" className="hover:text-white">Cookies</Link>
              <Link to="/dpa" className="hover:text-white">DPA</Link>
            </div>
            <p className="text-xs">2026 RecoverAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

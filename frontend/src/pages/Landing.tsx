import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, setAuthState } = useAuth();
  const [demoLoading, setDemoLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.title = 'RecoverAI — Autonomous AR Recovery for B2B SaaS';
    // Auto-redirect authenticated users to dashboard
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  /**
   * Demo handler — authenticate as demo user and go directly to dashboard
   */
  const handleTryDemo = async () => {
    setDemoLoading(true);
    try {
      const result = await api.post<{ user: any; company: any }>('/api/demo/login');
      localStorage.setItem('isDemo', 'true');
      setAuthState(result.user, result.company);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setDemoLoading(false);
      alert('Failed to start demo. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#09090b]" style={{
      backgroundImage: `
        radial-gradient(circle at 20% 50%, rgba(37, 99, 235, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.05) 0%, transparent 50%)
      `,
    }}>
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
          <ThemeToggle />
          <Link to="/login" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Sign in</Link>
          <Button size="sm" onClick={() => navigate('/signup')}>Become a Pilot</Button>
        </nav>
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle className="p-2 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors" />
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors">
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>
      </header>
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#09090b] px-6 py-4 flex flex-col gap-4">
          <Link to="/pricing" onClick={() => setMobileMenuOpen(false)} className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Pricing</Link>
          <Link to="/security" onClick={() => setMobileMenuOpen(false)} className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Security</Link>
          <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Sign in</Link>
          <Button size="sm" className="w-full" onClick={() => { setMobileMenuOpen(false); navigate('/signup'); }}>Become a Pilot</Button>
        </div>
      )}

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-blue-900/30 text-brand-700 dark:text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          Now live — see your cash runway in 60 seconds
        </div>
        <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white max-w-5xl mx-auto leading-tight">
          Stop Running<br />
          <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">Out of Cash.</span>
        </h1>
        <p className="mt-8 text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
          Real-time cash position, runway forecasting, and automated AR recovery — the daily financial command center your SaaS needs.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            className="px-8"
            onClick={() => navigate('/signup')}
          >
            Become a Pilot
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="px-8"
            onClick={handleTryDemo}
            disabled={demoLoading}
          >
            {demoLoading ? 'Loading demo...' : 'Try live demo'}
          </Button>
        </div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">14 days free pilot • See results fast</p>
        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500 max-w-md mx-auto">
          We only access your read-only invoice and payment data to analyze and automate recovery.
          We never move, hold, or process payments. You remain in control of all automation settings.
        </p>
      </main>

      {/* Trust signals */}
      <div className="border-y border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.015] py-3">
        <div className="max-w-4xl mx-auto px-6 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-400 dark:text-gray-500">
          {[
            { icon: '🔒', text: 'AES-256-GCM encryption' },
            { icon: '🛡️', text: 'SOC 2 in progress' },
            { icon: '🇺🇸', text: 'US data residency' },
            { icon: '🔑', text: 'Secure Stripe integration' },
            { icon: '📋', text: 'GDPR compliant' },
          ].map((item) => (
            <span key={item.text} className="flex items-center gap-1.5">
              <span>{item.icon}</span><span>{item.text}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: '< 1 min', label: 'Time to cash position' },
            { value: '4 channels', label: 'Recovery methods' },
            { value: '2 integrations', label: 'Stripe • QuickBooks' },
            { value: '14 days', label: 'Free pilot' },
          ].map((s) => (
            <div key={s.label} className="text-center bg-gray-50 dark:bg-[#111113] rounded-xl p-5">
              <div className="text-2xl font-bold text-brand-600">{s.value}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Product Preview */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-center text-sm font-medium text-gray-400 uppercase tracking-wider mb-6">
          Your dashboard — live in 60 seconds
        </p>
        <div className="rounded-2xl border border-gray-200 dark:border-white/[0.06] shadow-xl overflow-hidden">
          <div className="bg-gray-100 dark:bg-[#111113] border-b border-gray-200 dark:border-white/[0.06] px-4 py-2 flex items-center justify-between">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-white dark:bg-white/[0.03] rounded px-3 py-1 text-xs text-gray-400 text-center">
              app.recoverai.com/dashboard
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">Sample data</span>
          </div>
          <div className="bg-white dark:bg-[#09090b] p-5">
            {/* Row 1: Cash Runway + Cash Position + At-Risk */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800 text-center">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Cash Runway</p>
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">142 <span className="text-lg">days</span></p>
                <p className="text-xs text-emerald-500 mt-1">Healthy</p>
              </div>
              <div className="bg-gray-50 dark:bg-[#111113] rounded-xl p-4 border border-gray-100 dark:border-white/[0.06]">
                <p className="text-xs text-gray-400 mb-2">Cash Position</p>
                <div className="space-y-1">
                  {[{ d: '30d', v: '$285k' }, { d: '60d', v: '$312k' }, { d: '90d', v: '$340k' }].map(r => (
                    <div key={r.d} className="flex justify-between text-xs">
                      <span className="text-gray-500">{r.d}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-[#111113] rounded-xl p-4 border border-gray-100 dark:border-white/[0.06]">
                <p className="text-xs text-gray-400 mb-2">Cash Leakage</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">$18.2k</p>
                <div className="w-full h-2 bg-gray-200 dark:bg-white/[0.03] rounded-full mt-2 flex overflow-hidden">
                  <div className="bg-red-500 h-full" style={{ width: '45%' }} />
                  <div className="bg-amber-500 h-full" style={{ width: '30%' }} />
                  <div className="bg-purple-500 h-full" style={{ width: '25%' }} />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Failed</span><span>Delays</span><span>Churn</span>
                </div>
              </div>
            </div>
            {/* Row 2: At-risk customers */}
            <div className="space-y-1.5">
              {[
                { name: 'Acme Corp', amount: '$12,400', days: '42 days', risk: 94, color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
                { name: 'TechFlow Inc', amount: '$8,200', days: '21 days', risk: 67, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
                { name: 'GrowthCo', amount: '$3,100', days: '8 days', risk: 32, color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
              ].map((row) => (
                <div key={row.name} className="flex items-center justify-between bg-gray-50 dark:bg-[#111113] rounded-lg px-3 py-2 border border-gray-100 dark:border-white/[0.06]">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">{row.name}</span>
                  <span className="text-xs text-gray-400 hidden sm:block">{row.days} overdue</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{row.amount}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${row.color}`}>Risk {row.risk}</span>
                </div>
              ))}
            </div>
          </div>
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
              title: 'See your cash position instantly',
              desc: 'Cash runway, 30/60/90 day forecast, and leakage analysis calculated in real-time from your AR data.',
              color: 'bg-blue-100 dark:bg-blue-900/40 text-brand-600',
            },
            {
              step: '3',
              title: 'Agent recovers intelligently',
              desc: 'RecoverAI sends personalized emails, offers payment plans, and tracks payments — with configurable automation and optional human review.',
              color: 'bg-green-100 dark:bg-green-900/40 text-green-600',
            },
          ].map((item) => (
            <div key={item.step} className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-6">
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
      <section className="bg-gray-50 dark:bg-white/[0.02] py-14">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center mb-3">
            Your CFO command center
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-10">Cash visibility + autonomous recovery. Not a tool — an agent that does the work.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: '💰', title: 'Cash Position Forecast', desc: '30/60/90 day projections based on AR aging and customer payment history.' },
              { icon: '📅', title: 'Cash Runway Calculator', desc: 'Know exactly when you run out of cash. Color-coded alerts for critical thresholds.' },
              { icon: '🔮', title: 'What-If Scenarios', desc: 'Model "what if we lose Customer X?" or "what if we accelerate dunning?" in real-time.' },
              { icon: '📉', title: 'Cash Leakage Analysis', desc: 'See where money is bleeding: failed payments, delays, and customer churn breakdown.' },
              { icon: '📊', title: 'AI Risk Scoring', desc: '5-signal risk scoring (0-100) per customer. Identifies at-risk payments before they fail.' },
              { icon: '🤖', title: 'Autonomous Agent', desc: 'Automates payment follow-ups via email and SMS, with flexible controls and optional review.' },
              { icon: '✉️', title: '5-Email Dunning + SMS', desc: 'From friendly reminder to formal escalation. SMS fallback for higher response rates.' },
              { icon: '💳', title: 'Payment Plans', desc: 'Auto-offer installment plans based on risk. Customer clicks, Stripe charges automatically.' },
              { icon: '🔗', title: 'Multi-source Sync', desc: 'Stripe + QuickBooks. All invoices, payments, and customer data in one place.' },
            ].map((f) => (
              <div key={f.title} className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

{/* Early Access */}
      <section className="bg-gray-50 dark:bg-white/[0.02] py-14">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Now onboarding founding customers
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Join as a founding customer
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto">
            We're onboarding a limited number of B2B SaaS companies. First customers get
            locked-in pricing, personal onboarding, and direct access to the founding team.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { icon: '🔒', title: 'Locked-in pricing', desc: 'Early customers keep their rate forever as prices increase.' },
              { icon: '🤝', title: 'Founder onboarding', desc: 'I personally set up your first month. Not a support ticket queue.' },
              { icon: '🗺️', title: 'Shape the roadmap', desc: 'Direct line to the product team. Your use case gets priority.' },
            ].map((item) => (
              <div key={item.title} className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-6 text-left">
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
          <Button size="lg" className="px-8" onClick={() => navigate('/signup')}>Become a Pilot</Button>
          <p className="mt-3 text-xs text-gray-400">2-week pilot. We'll schedule a demo within 24 hours.</p>
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
              a: 'All credentials are encrypted with AES-256-GCM before storage. We never store plaintext API keys. Data is stored in US-based PostgreSQL. SOC 2 certification is in progress. See our Security page for details.',
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
              a: 'You pay a base monthly fee for platform access + a success fee only on recovered invoices. This aligns our incentives with yours — we only profit when you do. Apply for our pilot program to get 14 days free and see results. Pricing is custom based on your company size and recovery. Contact sales for a quote tailored to you.',
            },
          ].map((item) => (
            <details key={item.q} className="group bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-5">
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
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-gray-900 dark:to-gray-950 dark:border-t dark:border-white/[0.06] py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to recover more cash?
          </h2>
          <p className="text-blue-50 dark:text-gray-300 mb-10 text-lg">Join our pilot program. See results in 2 weeks. Convert to paid if it works.</p>
          <Button size="lg" className="bg-white !text-black hover:bg-gray-100 dark:bg-blue-600 dark:!text-white dark:hover:bg-blue-700 font-semibold px-12 py-3 shadow-lg" onClick={() => navigate('/signup')}>
            Become a Pilot
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 py-10 border-t border-gray-200 dark:border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white font-bold">
              <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-xs text-white">R</div>
              RecoverAI
            </div>
            <div className="flex flex-wrap gap-4 text-sm justify-center">
              <Link to="/pricing" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Pricing</Link>
              <Link to="/security" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Security</Link>
              <Link to="/support" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Support</Link>
              <Link to="/terms" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Terms</Link>
              <Link to="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Privacy</Link>
              <Link to="/cookie-policy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Cookies</Link>
              <Link to="/refund-policy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">Refund</Link>
              <Link to="/dpa" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">DPA</Link>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">2026 RecoverAI. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Landing;

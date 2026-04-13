import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { useSEO } from '../hooks/useSEO';
import { getPageSEO } from '../lib/seoConfig';
import { api } from '../lib/api';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, setAuthState } = useAuth();
  const { addToast } = useNotification();
  const [demoLoading, setDemoLoading] = useState(false);

  // SEO configuration
  useSEO(getPageSEO('landing'));

  useEffect(() => {
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
      addToast({
        type: 'error',
        message: 'Failed to start demo. Please try again.',
      });
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
      <header className="border-b border-gray-200 dark:border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/landing" className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 shrink-0">
            <div className="w-6 sm:w-7 h-6 sm:h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white text-xs sm:text-sm font-bold">R</span>
            </div>
            <span className="hidden sm:inline">RecoverAI</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-6 ml-auto">
            <nav className="hidden md:flex items-center gap-4 lg:gap-6">
              <Link to="/pricing" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Pricing</Link>
              <Link to="/security" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Security</Link>
            </nav>
            <ThemeToggle />
            <Link to="/login" className="hidden sm:block text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">Sign in</Link>
            <Button size="sm" onClick={() => navigate('/signup')}>Start Free Trial</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-blue-900/30 text-brand-700 dark:text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          Get paid 15-25 days faster. Eliminate 20 hours/month of ops work.
        </div>
        <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white max-w-5xl mx-auto leading-tight">
          Your AR on<br />
          <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">Autopilot</span>
        </h1>
        <p className="mt-8 text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
          Service agencies spend 20+ hours/month sending dunning emails and managing unpaid invoices. RecoverAI automates it all — reducing days to payment by 15-25 days and freeing up your ops person for higher-impact work.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            size="lg"
            className="px-8"
            onClick={() => navigate('/signup')}
          >
            Start Free Trial
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
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">21-day free trial • No credit card required</p>
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
            { value: '15-25 days', label: 'Faster DSO (Days to Payment)' },
            { value: '20 hrs/month', label: 'Ops labor saved' },
            { value: '$50-100K', label: 'Working capital freed (avg)' },
            { value: '21 days', label: 'Free trial' },
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
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
          Optimize your AR in 3 steps
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: '1',
              title: 'Connect Stripe or CSV (60 seconds)',
              desc: 'Authorize RecoverAI to read your invoices and payment data. We never move or process payments.',
              color: 'bg-purple-100 dark:bg-purple-900/40 text-purple-600',
            },
            {
              step: '2',
              title: 'AI analyzes payment timing',
              desc: 'Claude AI evaluates which customers to follow up with, when to send emails, and what tone works best for each customer.',
              color: 'bg-blue-100 dark:bg-blue-900/40 text-brand-600',
            },
            {
              step: '3',
              title: 'Autonomous dunning starts',
              desc: 'Personalized emails sent automatically based on customer behavior. Ops team freed up. DSO drops 15-25 days.',
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
            AR optimization meets automation
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-10">AI-powered platform that reduces DSO and eliminates ops work. Get paid faster. Save your team 20+ hours/month.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: '📊', title: 'DSO Tracking', desc: 'Measure days to payment in real-time. Watch it drop 15-25 days from automation.' },
              { icon: '⏱️', title: 'Hours Saved Metric', desc: 'See exactly how many hours your ops team freed up each week.' },
              { icon: '🤖', title: 'Autonomous Dunning', desc: 'AI sends personalized emails based on customer behavior. No ops approval needed.' },
              { icon: '📈', title: 'Customer Insights', desc: 'Which customers pay fast? Which need reminders? Data-driven decisions.' },
              { icon: '✉️', title: 'Smart Email Timing', desc: 'AI decides when to email each customer for best response. Not random schedules.' },
              { icon: '💬', title: 'Tone Optimization', desc: 'Generate friendly, neutral, or aggressive emails based on customer history.' },
              { icon: '💳', title: 'Payment Plans', desc: 'Offer installments to customers who can\'t pay in full. Improve outcomes.' },
              { icon: '🔗', title: 'Multi-source Sync', desc: 'Stripe + CSV + QuickBooks. All invoice data in one place.' },
              { icon: '⚙️', title: 'Full Controls', desc: 'Pause agent, review before send, set tone preference. You\'re always in control.' },
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

{/* Free Trial CTA */}
      <section className="bg-gray-50 dark:bg-white/[0.02] py-14">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            21-day free trial. See DSO drop. No credit card.
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            See 15-25 day DSO improvement in 21 days
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto">
            21-day free trial. Full access. Watch your team's AR workload drop by 20+ hours/month. Measure DSO improvement. Day 21, decide if it's worth it.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              { icon: '⚡', title: 'Fast setup', desc: 'Connect Stripe or upload CSV in 60 seconds.' },
              { icon: '📈', title: 'See real metrics', desc: 'Watch DSO drop. Track hours saved. Daily reports.' },
              { icon: '💬', title: 'Personal support', desc: 'I set everything up and monitor your results.' },
            ].map((item) => (
              <div key={item.title} className="bg-white dark:bg-[#111113] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-6 text-left">
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
          <Button size="lg" className="px-8" onClick={() => navigate('/signup')}>Start free trial</Button>
          <p className="mt-3 text-xs text-gray-400">No credit card required. No commitment. Cancel anytime.</p>
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
              q: 'How does RecoverAI measure DSO improvement?',
              a: 'We track days from invoice date to payment received. Day 1 baseline = your current DSO. Day 21 = new DSO with agent running. Most customers see 15-25 day improvement.',
            },
            {
              q: 'How much time does my team actually save?',
              a: 'Agent sends personalized dunning emails automatically. Your ops team no longer spends time writing/sending follow-ups. Track time saved in your dashboard. Most teams save 15-20 hours/month.',
            },
            {
              q: 'Is my data safe? Where is it stored?',
              a: 'All credentials are encrypted with AES-256-GCM before storage. We never store plaintext API keys. Data is stored in US-based PostgreSQL. SOC 2 certification is in progress. See our Security page for details.',
            },
            {
              q: 'Can I review emails before the agent sends them?',
              a: 'By default, the agent sends autonomously (that\'s the value). You can enable "Approval Mode" in Settings to review and approve each email before sending.',
            },
            {
              q: 'What integrations do you support?',
              a: 'Currently: Stripe, CSV import, and QuickBooks. Agent analyzes all invoice data and sends emails automatically from your account.',
            },
            {
              q: 'What happens after the 21-day free trial?',
              a: 'You\'ll see real metrics—DSO improvement, hours saved, customer behavior insights. Then we discuss custom pricing based on your results and company size. No forced upgrades.',
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
            Free your ops team. Get paid faster.
          </h2>
          <p className="text-blue-50 dark:text-gray-300 mb-10 text-lg">21-day free trial. See 15-25 day DSO improvement. Save 20+ hours/month of ops work. No credit card required.</p>
          <Button size="lg" className="bg-white !text-black hover:bg-gray-100 dark:bg-blue-600 dark:!text-white dark:hover:bg-blue-700 font-semibold px-12 py-3 shadow-lg" onClick={() => navigate('/signup')}>
            Start Free Trial
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

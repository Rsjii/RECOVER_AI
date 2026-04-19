import React from 'react';
import { PublicHeader } from '../components/layout/PublicHeader';
import { PublicFooter } from '../components/layout/PublicFooter';
import { useSEO } from '../hooks/useSEO';
import { getPageSEO } from '../lib/seoConfig';

const SecurityPage: React.FC = () => {
  // SEO configuration
  useSEO(getPageSEO('security'));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b]">
      <PublicHeader />

      {/* Hero Section */}
      <section className="bg-white dark:bg-[#111113] border-b border-gray-200 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 mb-6">
            <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
            Enterprise-grade security
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Your customers' financial data deserves the highest level of protection. RecoverAI is built
            from the ground up with security, privacy, and compliance at its core.
          </p>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 -mt-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'SOC 2 in progress', sub: 'Infrastructure via Supabase' },
            { label: 'GDPR', sub: 'Data protection built-in' },
            { label: 'AES-256', sub: 'Encryption standard' },
            { label: 'TLS 1.3', sub: 'Data in transit' },
          ].map((badge) => (
            <div
              key={badge.label}
              className="flex flex-col items-center justify-center rounded-xl bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] shadow-sm px-4 py-5 text-center"
            >
              <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                {badge.label}
              </span>
              <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">{badge.sub}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Detail Cards */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Data Security */}
          <div className="rounded-xl bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data Security</h2>
            </div>
            <ul className="space-y-2.5 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-emerald-500 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>AES-256-GCM encryption for all data at rest</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-emerald-500 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>TLS 1.3 enforced for all data in transit</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-emerald-500 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>API keys and OAuth tokens encrypted before storage</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-emerald-500 dark:text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>No plaintext secrets -- all credentials managed via environment variables</span>
              </li>
            </ul>
          </div>

          {/* Access Control */}
          <div className="rounded-xl bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Access Control</h2>
            </div>
            <ul className="space-y-2.5 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-blue-500 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Role-based access control with least-privilege defaults</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-blue-500 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>JWT authentication with httpOnly secure cookies</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-blue-500 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Automatic session expiry and refresh token rotation</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-blue-500 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Multi-factor authentication support</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-blue-500 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Strict tenant isolation -- no cross-company data access</span>
              </li>
            </ul>
          </div>

          {/* Infrastructure */}
          <div className="rounded-xl bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Infrastructure</h2>
            </div>
            <ul className="space-y-2.5 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-purple-500 dark:text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>PostgreSQL hosted on Supabase (SOC 2 Type II provider)</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-purple-500 dark:text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Redis on Upstash with encrypted connections</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-purple-500 dark:text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Automated daily backups with point-in-time recovery</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-purple-500 dark:text-purple-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>99.9% uptime SLA with health monitoring and alerting</span>
              </li>
            </ul>
          </div>

          {/* Compliance */}
          <div className="rounded-xl bg-white dark:bg-[#111113] border border-gray-200 dark:border-white/[0.06] shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Compliance</h2>
            </div>
            <ul className="space-y-2.5 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-amber-500 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>GDPR-compliant data export and deletion workflows</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-amber-500 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>CAN-SPAM compliant emails with one-click unsubscribe</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-amber-500 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Full audit logging for sensitive actions and policy decisions</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-amber-500 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Webhook signature verification and idempotent event handling</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 text-amber-500 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Data Processing Agreement (DPA) available on request</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-white dark:bg-[#111113] border-t border-gray-200 dark:border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-14 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Questions about security?
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            We are happy to discuss our security practices, provide documentation, or schedule a review.
          </p>
          <a
            href="mailto:hello@recoverai.tech"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            hello@recoverai.tech
          </a>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
};

export default SecurityPage;

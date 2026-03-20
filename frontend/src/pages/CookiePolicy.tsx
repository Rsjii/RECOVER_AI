import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const CookiePolicy: React.FC = () => {
  useEffect(() => { document.title = 'Cookie Policy — RecoverAI'; }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cookie Policy</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Effective Date: March 1, 2026</p>
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          This Cookie Policy explains how RecoverAI, Inc. ("RecoverAI," "we," "us," or "our") uses cookies and similar tracking technologies when you visit or use our platform. This policy should be read alongside our Privacy Policy, which describes how we handle personal data more broadly.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">1. What Are Cookies</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Cookies are small text files that are stored on your device (computer, tablet, or mobile phone) when you visit a website. They are widely used to make websites function properly, improve user experience, and provide reporting information. Cookies may be set by the website you are visiting ("first-party cookies") or by third-party services operating on that website ("third-party cookies"). Cookies can persist for varying periods depending on their purpose; session cookies expire when you close your browser, while persistent cookies remain until they expire or are manually deleted.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">2. Essential Cookies</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
          These cookies are strictly necessary for the Service to function and cannot be disabled. Without these cookies, core features such as authentication and secure access would not be available. Essential cookies do not require your consent under applicable privacy laws.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 dark:border-white/[0.06] rounded-lg">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#111113]">
                <th className="text-left px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-200 dark:border-white/[0.06]">Cookie Name</th>
                <th className="text-left px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-200 dark:border-white/[0.06]">Purpose</th>
                <th className="text-left px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-200 dark:border-white/[0.06]">Duration</th>
                <th className="text-left px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-200 dark:border-white/[0.06]">Type</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                <td className="px-4 py-2.5 font-mono text-xs">session_token</td>
                <td className="px-4 py-2.5">Maintains your authenticated session after login. Required for accessing protected pages and API endpoints.</td>
                <td className="px-4 py-2.5">7 days</td>
                <td className="px-4 py-2.5">First-party</td>
              </tr>
              <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                <td className="px-4 py-2.5 font-mono text-xs">csrf_token</td>
                <td className="px-4 py-2.5">Protects against cross-site request forgery attacks by validating that requests originate from our application.</td>
                <td className="px-4 py-2.5">Session</td>
                <td className="px-4 py-2.5">First-party</td>
              </tr>
              <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                <td className="px-4 py-2.5 font-mono text-xs">theme_pref</td>
                <td className="px-4 py-2.5">Stores your display preference (light or dark mode) so the interface renders correctly on each visit.</td>
                <td className="px-4 py-2.5">1 year</td>
                <td className="px-4 py-2.5">First-party</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-xs">cookie_consent</td>
                <td className="px-4 py-2.5">Records your cookie preferences so we do not repeatedly prompt you for consent.</td>
                <td className="px-4 py-2.5">1 year</td>
                <td className="px-4 py-2.5">First-party</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">3. Analytics Cookies</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
          We may use analytics cookies to understand how visitors interact with the Service. These cookies collect information in an aggregated form to help us improve the platform's performance and usability. Analytics cookies are only set with your explicit consent.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 dark:border-white/[0.06] rounded-lg">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#111113]">
                <th className="text-left px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-200 dark:border-white/[0.06]">Cookie Name</th>
                <th className="text-left px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-200 dark:border-white/[0.06]">Purpose</th>
                <th className="text-left px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-200 dark:border-white/[0.06]">Duration</th>
                <th className="text-left px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-200 dark:border-white/[0.06]">Type</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                <td className="px-4 py-2.5 font-mono text-xs">_plausible</td>
                <td className="px-4 py-2.5">Privacy-focused analytics tracking. Collects aggregate page view and session data without personal identifiers.</td>
                <td className="px-4 py-2.5">1 year</td>
                <td className="px-4 py-2.5">First-party</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-mono text-xs">_rai_session</td>
                <td className="px-4 py-2.5">Tracks session duration and page navigation patterns to identify usability issues and optimize workflows.</td>
                <td className="px-4 py-2.5">30 minutes</td>
                <td className="px-4 py-2.5">First-party</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">4. How to Manage Cookies</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          You have several options for managing cookies:
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">Browser Settings:</span> Most web browsers allow you to control cookies through their settings. You can typically configure your browser to block all cookies, accept all cookies, or notify you when a cookie is set. Consult your browser's help documentation for specific instructions. Note that blocking essential cookies will prevent you from using the Service.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">Consent Preferences:</span> When you first visit our platform, you will be presented with a cookie consent banner that allows you to accept or decline non-essential cookies. You can update your preferences at any time through the Settings page in your account.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          <span className="font-medium text-gray-900 dark:text-gray-100">Deleting Cookies:</span> You can delete cookies already stored on your device through your browser settings. Deleting session or authentication cookies will require you to log in again on your next visit.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">5. Do Not Track Signals</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Some browsers offer a "Do Not Track" (DNT) signal that indicates you do not wish to be tracked. RecoverAI honors DNT signals. When we detect a DNT signal, we disable all non-essential cookies and analytics tracking for that session. We do not engage in cross-site tracking regardless of the DNT setting.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">6. Changes to This Cookie Policy</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          We may update this Cookie Policy from time to time to reflect changes in technology, regulation, or our business practices. We will notify you of material changes by updating the effective date at the top of this page and, where appropriate, providing additional notice through the Service. We encourage you to review this policy periodically.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">7. Contact Us</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          If you have questions about our use of cookies or this Cookie Policy, please contact us at privacy@recoverai.com or by mail at RecoverAI, Inc., 1209 Orange Street, Wilmington, DE 19801, United States.
        </p>

        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-white/[0.06]">
          <Link to="/landing" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;

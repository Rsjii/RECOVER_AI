import React, { useEffect } from 'react';

const Support: React.FC = () => {
  useEffect(() => { document.title = 'Support & Contact — RecoverAI'; }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Contact & Support</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Get in touch with our team</p>

        <div className="mt-8 bg-white dark:bg-[#111113] rounded-lg p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Reach Out to Us</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">Email</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <a href="mailto:support@recoverai.com" className="text-blue-600 dark:text-blue-400 hover:underline">
                  support@recoverai.com
                </a>
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">Phone</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                +91 75097 95114 (India timezone: IST)
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-1">Mailing Address</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                RecoverAI<br />
                New Housing Board Colony<br />
                Deluxe MIG 186<br />
                Morena 476001, MP<br />
                India
              </p>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-12 mb-4">Support Hours</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          We provide support via email 24/7. Response time is typically within 24 business hours.
          For urgent issues, please include "URGENT" in your subject line.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">What We Can Help With</h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>Account setup and configuration</li>
          <li>Integration troubleshooting (Stripe, QuickBooks, Chargebee)</li>
          <li>Agent policy customization</li>
          <li>Billing and subscription questions</li>
          <li>General product support and usage</li>
          <li>Data export and account management</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Common Issues</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-1">I can't connect my Stripe account</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Make sure you're using the correct API keys and that they have the necessary permissions.
              Contact support@recoverai.com with your account email and we'll help troubleshoot.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-1">How do I export my data?</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              You can export all your data from the Settings page. Go to Settings → Data Export and
              click "Export All Data". You'll receive your data in JSON format within 24 hours.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-1">How do I cancel my subscription?</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              You can cancel anytime from the Billing page. Go to Billing → Cancel Subscription.
              Your access will end at the end of the current billing cycle. See our{' '}
              <a href="/refund-policy" className="text-blue-600 dark:text-blue-400 hover:underline">
                Cancellation & Refund Policy
              </a>{' '}
              for more details.
            </p>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">Compliance & Legal</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          For legal matters, compliance questions, or formal requests, please email:
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
          legal@recoverai.com
        </p>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-8 pt-8 border-t border-gray-200 dark:border-white/[0.06]">
          Last updated: March 17, 2026
        </p>
      </div>
    </div>
  );
};

export default Support;

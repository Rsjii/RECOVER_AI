import React, { useEffect } from 'react';

const Refund: React.FC = () => {
  useEffect(() => { document.title = 'Refund & Cancellation Policy — RecoverAI'; }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Cancellation & Refund Policy</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Effective Date: March 1, 2026</p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">Free Trial (21 Days)</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          All RecoverAI accounts start with a complimentary 21-day free trial. During the trial period, you have full
          access to all features with no credit card required. If you decide to cancel during the trial:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 mt-3">
          <li><span className="font-medium">Full Refund:</span> If you cancel within 7 days of trial start</li>
          <li><span className="font-medium">No Refund:</span> If you cancel after 7 days but before trial expires</li>
          <li><span className="font-medium">How to Refund:</span> Email support@recoverai.com with your account email. No questions asked.</li>
          <li><span className="font-medium">Auto-Conversion:</span> If trial expires without cancellation, you will be charged for the selected plan</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">Paid Plans (Monthly or Annual)</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Once you've converted to a paid plan, the following refund and cancellation policy applies:
        </p>

        <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Refunds for Paid Subscriptions</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          <span className="font-medium">No refunds</span> will be issued for paid subscription periods. Once the Service has been activated
          for your account and made available to you, the billing period is non-refundable. This is because:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>The Service begins immediately upon payment and is accessed and used by you</li>
          <li>We incur costs (infrastructure, AI providers, email delivery) starting from your billing date</li>
          <li>Our pricing includes all features, and refunds would create unfair advantage for short-term users</li>
        </ul>

        <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Mid-Cycle Cancellation</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          If you cancel after your billing date but before the end of the billing cycle:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 mt-3">
          <li><span className="font-medium">Prorated Credit:</span> You will receive a credit for the unused portion of your subscription</li>
          <li><span className="font-medium">Example:</span> If you cancel on day 20 of a 30-day month, you receive 10 days of credit</li>
          <li><span className="font-medium">Application:</span> Credit is applied to reduce your next invoice or can be refunded upon request</li>
        </ul>

        <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Cancellation Process</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          You can cancel your subscription anytime, effective at the end of your current billing cycle:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>Log into your RecoverAI account</li>
          <li>Go to <span className="font-mono bg-gray-100 dark:bg-[#111113] px-1 rounded">Billing</span> → <span className="font-mono bg-gray-100 dark:bg-[#111113] px-1 rounded">Current Plan</span></li>
          <li>Click <span className="font-mono bg-gray-100 dark:bg-[#111113] px-1 rounded">Cancel Subscription</span></li>
          <li>Confirm cancellation</li>
          <li>Your access will end after the current billing cycle completes</li>
        </ol>

        <h3 className="text-lg font-medium text-gray-900 dark:text-white mt-6 mb-3">Payment Issues</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          If your payment fails:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 mt-3">
          <li><span className="font-medium">Retry Logic:</span> We'll attempt to charge your payment method up to 3 times over 5 business days</li>
          <li><span className="font-medium">Service Pause:</span> If all retries fail, your service will be paused (not deleted)</li>
          <li><span className="font-medium">Reactivation:</span> You can reactivate by updating your payment method and retrying</li>
          <li><span className="font-medium">No Auto-Refund:</span> Failed payment does not entitle you to a refund of prior usage</li>
          <li><span className="font-medium">Contact Support:</span> If you have payment issues, email support@recoverai.com</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">Annual Plans</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Annual plans come with a 20% discount (equivalent to 2 months free). The same cancellation and refund policies apply,
          but cancellation takes effect at the end of your annual billing cycle (12 months from purchase date).
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">Recovery Fee Refunds</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          RecoverAI charges an outcome-based recovery fee (1% of successfully recovered amounts) in addition to the base subscription fee.
          Recovery fees are only charged on payments actually received and tracked by our system. Recovery fees are:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 mt-3">
          <li><span className="font-medium">Non-refundable</span> once the recovery has been processed and tracked</li>
          <li><span className="font-medium">Recalculated monthly</span> and included in your monthly invoice</li>
          <li><span className="font-medium">Clear and Transparent:</span> Your invoice shows base fee + recovery fee breakdown</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">Exceptions & Disputes</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          If you believe you're entitled to a refund or credit due to a service failure or other exceptional circumstance:
        </p>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 mt-3">
          <li>Contact <a href="mailto:support@recoverai.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@recoverai.com</a> within 7 days of the issue</li>
          <li>Provide detailed explanation and evidence of the service failure</li>
          <li>We will review your case and respond within 5 business days</li>
          <li>If your claim is valid, we may offer a partial credit or refund at our discretion</li>
        </ol>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">Data After Cancellation</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          When you cancel your subscription:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>Your account remains accessible for 30 days after cancellation</li>
          <li>You can export all your data during this 30-day window</li>
          <li>After 30 days, your data is permanently deleted (unless you request export)</li>
          <li>We do not retain backup copies of deleted data</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">Satisfaction Guarantee</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          We're confident you'll love RecoverAI. However, if you're not completely satisfied within your first 7 days:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 mt-3">
          <li>Contact <a href="mailto:support@recoverai.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@recoverai.com</a> within 7 days</li>
          <li>Explain what didn't work for you</li>
          <li>We'll discuss options: refund, troubleshooting, or custom configuration</li>
          <li>No hard feelings — we just want you to succeed</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">Questions?</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Have questions about refunds or cancellation? Reach out anytime:
        </p>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300 mt-3">
          <li>Email: <a href="mailto:support@recoverai.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@recoverai.com</a></li>
          <li>Phone: +91 75097 95114</li>
        </ul>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-8 pt-8 border-t border-gray-200 dark:border-white/[0.06]">
          Last updated: March 17, 2026
        </p>
      </div>
    </div>
  );
};

export default Refund;

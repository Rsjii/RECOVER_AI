import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const Privacy: React.FC = () => {
  useEffect(() => { document.title = 'Privacy Policy — RecoverAI'; }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Effective Date: March 1, 2026</p>
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          RecoverAI, Inc. ("RecoverAI," "we," "us," or "our") is committed to protecting the privacy of our customers and their end users. This Privacy Policy describes how we collect, use, disclose, and safeguard information when you use our autonomous accounts receivable recovery platform (the "Service"). By using the Service, you consent to the practices described in this policy.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">1. Information We Collect</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          We collect information in several categories to provide and improve the Service:
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">Account Information:</span> When you register for the Service, we collect your name, email address, company name, job title, and billing information. This information is necessary to create and manage your account.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">Invoice and Billing Data:</span> To provide recovery services, we access and process invoice records, payment histories, customer contact information, and outstanding balance data from your connected billing platforms (such as Stripe, QuickBooks, or Chargebee). This data is processed solely to perform the Service on your behalf.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">Communication Data:</span> We store records of all dunning emails sent through the Service, including email content, delivery status, open tracking, and click tracking data. This data helps you monitor recovery performance and communication effectiveness.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">Usage Data:</span> We automatically collect information about how you interact with the Service, including pages visited, features used, timestamps, browser type, IP address, and device information. We use this data to improve the Service and troubleshoot issues.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">2. How We Use Your Information</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          We use the information we collect for the following purposes:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-1 ml-2">
          <li>To provide, operate, and maintain the Service, including sending AI-generated dunning communications on your behalf</li>
          <li>To generate recovery analytics, reports, and insights about your accounts receivable performance</li>
          <li>To process billing and collect fees owed for use of the Service</li>
          <li>To communicate with you about your account, service updates, and support requests</li>
          <li>To detect, prevent, and address fraud, security issues, and technical problems</li>
          <li>To comply with legal obligations and enforce our Terms of Service</li>
          <li>To improve and optimize the Service through aggregated and anonymized usage analysis</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">3. Data Sharing and Third-Party Services</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          We do not sell your data to third parties. We share data only with the following categories of service providers, solely to the extent necessary to deliver the Service:
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">Payment Processing:</span> Stripe processes payment transactions and stores payment method data. Stripe's handling of your data is governed by the <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Stripe Privacy Policy</a>.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">Email Delivery:</span> Resend handles the delivery of dunning emails on your behalf. Email addresses and message content are transmitted to Resend for delivery purposes only.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">AI Providers:</span> Anthropic (Claude) and OpenAI process invoice and customer data to generate personalized dunning email content. Data sent to AI providers is limited to what is necessary for content generation and is not used by these providers to train their models.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">Infrastructure:</span> Supabase (PostgreSQL database) and Upstash (Redis cache) store and process data as part of our infrastructure. Both providers maintain SOC 2 Type II compliance.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
          We may also disclose information if required to do so by law, regulation, or legal process, or if we believe in good faith that disclosure is necessary to protect our rights, your safety, or the safety of others.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">4. Data Security</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          We implement industry-standard security measures to protect your data. All data is encrypted in transit using TLS 1.2 or higher and at rest using AES-256 encryption. Access to production systems is restricted to authorized personnel using role-based access controls and multi-factor authentication. We conduct regular security assessments and maintain audit logs for all administrative actions. While no method of transmission or storage is 100% secure, we are committed to protecting the confidentiality and integrity of your data using commercially reasonable safeguards.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">5. Data Retention</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          We retain your account information and associated data for as long as your account is active or as needed to provide the Service. Invoice and communication records are retained for the duration of your subscription plus 90 days following account termination, after which they are permanently deleted. Aggregated and anonymized analytics data that cannot be used to identify any individual may be retained indefinitely. You may request earlier deletion of your data at any time, subject to our legal and regulatory retention obligations.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">6. Your Rights</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          Depending on your jurisdiction, you may have the following rights regarding your personal data:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-1 ml-2">
          <li><span className="font-medium text-gray-900 dark:text-gray-100">Right of Access:</span> You may request a copy of the personal data we hold about you and your organization.</li>
          <li><span className="font-medium text-gray-900 dark:text-gray-100">Right to Export:</span> You may request your data in a standard machine-readable format (JSON or CSV) for portability purposes.</li>
          <li><span className="font-medium text-gray-900 dark:text-gray-100">Right to Correction:</span> You may request correction of inaccurate or incomplete personal data.</li>
          <li><span className="font-medium text-gray-900 dark:text-gray-100">Right to Deletion:</span> You may request deletion of your personal data, subject to our retention obligations.</li>
          <li><span className="font-medium text-gray-900 dark:text-gray-100">Right to Object:</span> You may object to our processing of your personal data in certain circumstances.</li>
        </ul>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
          To exercise any of these rights, contact us at privacy@recoverai.com. We will respond to verified requests within 30 days. For end users whose data is processed by RecoverAI on behalf of our customers, please contact the relevant business directly, as they are the data controller for your information.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">7. International Data Transfers</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Our Service is hosted in the United States. If you access the Service from outside the United States, your data may be transferred to and processed in the United States and other countries where our service providers operate. We ensure appropriate safeguards are in place for international data transfers, including Standard Contractual Clauses (SCCs) where required. By using the Service, you consent to the transfer of your data to the United States and other jurisdictions as described in this policy.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">8. Children's Privacy</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          The Service is a B2B platform and is not directed at individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected personal data from a child, we will take steps to delete that information promptly.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">9. Changes to This Policy</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          We may update this Privacy Policy from time to time to reflect changes in our practices or applicable law. We will notify you of material changes by email or through a prominent notice in the Service at least 30 days before the changes take effect. We encourage you to review this policy periodically. Your continued use of the Service after any modifications constitutes your acceptance of the updated policy.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">10. Contact Us</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          If you have questions or concerns about this Privacy Policy or our data practices, please contact us at privacy@recoverai.com or by mail at RecoverAI, Inc., 1209 Orange Street, Wilmington, DE 19801, United States.
        </p>

        <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Link to="/landing" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Privacy;

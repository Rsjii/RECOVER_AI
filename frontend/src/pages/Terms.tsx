import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const Terms: React.FC = () => {
  useEffect(() => { document.title = 'Terms of Service — RecoverAI'; }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Effective Date: March 1, 2026</p>
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          These Terms of Service ("Terms") constitute a legally binding agreement between you ("Customer," "you," or "your") and RecoverAI, Inc. ("RecoverAI," "we," "us," or "our") governing your access to and use of the RecoverAI platform, including all related APIs, integrations, and services (collectively, the "Service"). By creating an account or using the Service, you agree to be bound by these Terms.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">1. Acceptance of Terms</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          By accessing or using the Service, you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you are entering into these Terms on behalf of a company or other legal entity, you represent that you have the authority to bind such entity to these Terms. If you do not agree to these Terms, you must not access or use the Service.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">2. Eligibility</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          The Service is intended for use by businesses and is not directed at individual consumers. You must be at least 18 years of age and have the legal capacity to enter into a binding contract. You represent that the business on whose behalf you are using the Service is duly organized and validly existing under applicable law. We reserve the right to refuse service to any entity at our sole discretion.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">3. Description of Service</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          RecoverAI provides an autonomous accounts receivable (AR) recovery platform for B2B SaaS companies. The Service uses artificial intelligence to generate and send dunning communications to your customers with overdue invoices, offer structured payment plans, and track payment status through integrations with your billing and payment infrastructure. RecoverAI operates autonomously once configured, sending communications and managing recovery workflows without requiring manual approval for each action. The Service integrates with third-party platforms including Stripe, QuickBooks, and Chargebee to synchronize invoice and payment data.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">4. Account Registration and Responsibilities</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          You must provide accurate, complete, and current information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account or any other breach of security. We are not liable for any loss or damage arising from your failure to safeguard your account credentials. You are responsible for ensuring that your use of the Service complies with all applicable laws, including but not limited to debt collection regulations in your jurisdiction.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">5. Billing and Payment</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          RecoverAI uses an outcome-based pricing model. Fees consist of a monthly base subscription fee plus a percentage of successfully recovered amounts. The current standard pricing is a base fee of $2,500 per month plus 1% of all amounts recovered through the Service during the billing period. Recovered amounts are calculated based on payments received on invoices that were actively managed by RecoverAI during the collection period. All fees are billed monthly in arrears and are due within 30 days of invoice date. Prices are exclusive of applicable taxes. We reserve the right to modify pricing with 30 days' prior written notice; continued use of the Service after the effective date of a price change constitutes acceptance of the new pricing.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">6. Data Ownership</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          You retain all right, title, and interest in and to your data, including invoice records, customer information, payment histories, and any other data you provide to or generate through the Service ("Customer Data"). You grant RecoverAI a limited, non-exclusive license to process, store, and transmit Customer Data solely for the purpose of providing the Service. We will not sell, rent, or share Customer Data with third parties except as required to deliver the Service (e.g., sending emails via our email provider) or as required by law. Upon termination, you may request export of your Customer Data in a standard machine-readable format within 30 days.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">7. Acceptable Use</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          You agree to use the Service only for its intended purpose of managing accounts receivable recovery for legitimate business invoices. You shall not use the Service to collect on fraudulent or disputed debts, to harass or threaten any individual, or to violate any applicable law or regulation including the Fair Debt Collection Practices Act (FDCPA), CAN-SPAM Act, or equivalent legislation in your jurisdiction. You shall not attempt to reverse-engineer, decompile, or disassemble the Service, or interfere with or disrupt the integrity or performance of the Service. Violation of this section may result in immediate suspension or termination of your account.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">8. AI-Generated Communications</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          The Service uses artificial intelligence to generate email communications sent to your customers. While we employ commercially reasonable efforts to ensure these communications are professional, accurate, and compliant with applicable regulations, you acknowledge that AI-generated content may occasionally contain errors or inconsistencies. You are responsible for configuring the tone, escalation policies, and communication parameters within the Service. You agree to review and monitor the communications sent on your behalf and to notify us promptly of any issues.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">9. Service Availability</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          We will use commercially reasonable efforts to maintain the availability of the Service. However, we do not guarantee uninterrupted or error-free operation. The Service may be temporarily unavailable due to scheduled maintenance, upgrades, or circumstances beyond our control. We will make reasonable efforts to provide advance notice of planned downtime. Our target uptime for the Service is 99.9% measured on a monthly basis, excluding scheduled maintenance windows.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">10. Limitation of Liability</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, RECOVERAI SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOST PROFITS, LOST REVENUE, LOST DATA, OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY. OUR TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THESE TERMS SHALL NOT EXCEED THE AMOUNTS PAID BY YOU TO RECOVERAI DURING THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM. RecoverAI is not liable for the failure of your customers to pay their outstanding invoices or for any damages resulting from communications sent by the Service on your behalf.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">11. Indemnification</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          You agree to indemnify, defend, and hold harmless RecoverAI and its officers, directors, employees, and agents from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any applicable law or regulation; or (d) any dispute between you and your customers regarding the debts managed through the Service.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">12. Termination</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Either party may terminate these Terms at any time by providing 30 days' written notice to the other party. We may suspend or terminate your access to the Service immediately if you breach any provision of these Terms or if we are required to do so by law. Upon termination, your right to use the Service ceases immediately, and you remain liable for any fees incurred prior to termination. Sections relating to data ownership, limitation of liability, indemnification, and governing law shall survive termination.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">13. Modifications to Terms</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          We reserve the right to modify these Terms at any time. We will notify you of material changes by email or through a notice within the Service at least 30 days before the changes take effect. Your continued use of the Service after the effective date of any modifications constitutes your acceptance of the revised Terms. If you do not agree to the modified Terms, you must discontinue use of the Service before the changes take effect.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">14. Governing Law and Dispute Resolution</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any disputes arising out of or related to these Terms shall be resolved through binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules. The arbitration shall take place in Wilmington, Delaware. Each party shall bear its own costs, and the arbitrator's decision shall be final and binding. Nothing in this section prevents either party from seeking injunctive relief in a court of competent jurisdiction.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">15. General Provisions</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          These Terms, together with the Privacy Policy and any applicable Data Processing Addendum, constitute the entire agreement between you and RecoverAI with respect to the Service. If any provision of these Terms is found to be unenforceable, the remaining provisions shall remain in full force and effect. Our failure to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision. You may not assign or transfer these Terms without our prior written consent; we may assign these Terms without restriction.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">16. Contact Information</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          If you have any questions about these Terms, please contact us at legal@recoverai.com or by mail at RecoverAI, Inc., 1209 Orange Street, Wilmington, DE 19801, United States.
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

export default Terms;

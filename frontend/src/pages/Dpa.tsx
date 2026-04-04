import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

const Dpa: React.FC = () => {
  useEffect(() => { document.title = 'Data Processing Addendum — RecoverAI'; }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#09090b]">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Data Processing Addendum</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Effective Date: March 1, 2026</p>
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          This Data Processing Addendum ("DPA") forms part of the agreement between you ("Customer," "Controller") and RecoverAI, Inc. ("RecoverAI," "Processor") governing the processing of personal data in connection with the RecoverAI platform (the "Service"). This DPA applies to the extent that RecoverAI processes personal data on behalf of the Customer in the course of providing the Service, and supplements the Terms of Service and Privacy Policy.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">1. Definitions</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">"Controller"</span> means the entity that determines the purposes and means of the processing of personal data. In the context of this DPA, the Customer is the Controller with respect to end-user data processed through the Service.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">"Processor"</span> means the entity that processes personal data on behalf of the Controller. RecoverAI acts as the Processor when handling Customer's end-user data to provide the Service.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">"Data Subject"</span> means an identified or identifiable natural person whose personal data is processed. In the context of this DPA, Data Subjects are typically the Customer's end customers whose invoice and contact information is processed by the Service.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">"Personal Data"</span> means any information relating to a Data Subject, including names, email addresses, billing addresses, invoice amounts, and payment histories processed through the Service.
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          <span className="font-medium text-gray-900 dark:text-gray-100">"Sub-processor"</span> means any third party engaged by RecoverAI to process Personal Data on behalf of the Customer in connection with the Service.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">2. Scope and Purpose of Processing</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          RecoverAI processes Personal Data solely to provide the intelligent accounts receivable recovery Service as described in the Terms of Service, according to Customer-configured policies and automation settings. The specific processing activities include:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-1 ml-2">
          <li>Importing and storing invoice records, customer contact information, and payment histories from connected billing platforms</li>
          <li>Generating and sending AI-powered dunning email communications to Data Subjects with overdue invoices</li>
          <li>Creating and managing payment plan offers for Data Subjects</li>
          <li>Tracking email delivery, open rates, and click events for recovery analytics</li>
          <li>Processing payment status updates and reconciling recovered amounts</li>
        </ul>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
          The categories of Personal Data processed include: names, email addresses, business names, invoice amounts, payment histories, billing addresses, and communication records. RecoverAI does not process sensitive personal data (e.g., health data, racial or ethnic origin) unless inadvertently included in invoice descriptions by the Customer.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">3. Obligations of the Processor</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          RecoverAI shall process Personal Data only on documented instructions from the Customer, unless required by applicable law to do otherwise (in which case RecoverAI shall inform the Customer of that legal requirement before processing, unless prohibited by law). RecoverAI shall ensure that persons authorized to process Personal Data have committed themselves to confidentiality or are under an appropriate statutory obligation of confidentiality. RecoverAI shall take all reasonable steps to ensure that Personal Data is processed in accordance with this DPA and applicable data protection laws.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">4. Security Measures</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
          RecoverAI implements and maintains appropriate technical and organizational measures to protect Personal Data against unauthorized or unlawful processing, accidental loss, destruction, or damage. These measures include:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-1 ml-2">
          <li><span className="font-medium text-gray-900 dark:text-gray-100">Encryption:</span> All data is encrypted in transit using TLS 1.2+ and at rest using AES-256 encryption</li>
          <li><span className="font-medium text-gray-900 dark:text-gray-100">Access Control:</span> Role-based access controls (RBAC) with multi-factor authentication for all administrative access to production systems</li>
          <li><span className="font-medium text-gray-900 dark:text-gray-100">Tenant Isolation:</span> Strict logical data separation between Customer accounts using company-scoped queries at the database level</li>
          <li><span className="font-medium text-gray-900 dark:text-gray-100">Audit Logging:</span> Comprehensive audit trails for all data access and administrative actions</li>
          <li><span className="font-medium text-gray-900 dark:text-gray-100">Vulnerability Management:</span> Regular dependency updates, security assessments, and penetration testing</li>
          <li><span className="font-medium text-gray-900 dark:text-gray-100">Backup and Recovery:</span> Automated daily database backups with point-in-time recovery capabilities</li>
        </ul>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">5. Sub-processors</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
          The Customer provides general authorization for RecoverAI to engage Sub-processors to assist in providing the Service. RecoverAI will notify the Customer of any intended changes to the list of Sub-processors at least 30 days before engaging a new Sub-processor. The Customer may object to such changes by providing written notice within 14 days; if the parties cannot resolve the objection, the Customer may terminate the affected Service. RecoverAI ensures that each Sub-processor is bound by data protection obligations no less protective than those set out in this DPA.
        </p>
        <div className="overflow-x-auto sm:scrollbar-show">
          <table className="w-full text-sm border border-gray-200 dark:border-white/[0.06] rounded-lg">
            <thead>
              <tr className="bg-gray-100 dark:bg-[#111113]">
                <th className="text-left px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-200 dark:border-white/[0.06]">Sub-processor</th>
                <th className="text-left px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-200 dark:border-white/[0.06]">Purpose</th>
                <th className="text-left px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-200 dark:border-white/[0.06]">Data Processed</th>
                <th className="text-left px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium border-b border-gray-200 dark:border-white/[0.06]">Location</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">Supabase</td>
                <td className="px-4 py-2.5">PostgreSQL database hosting and management</td>
                <td className="px-4 py-2.5">All Customer Data (invoices, contacts, communications, account records)</td>
                <td className="px-4 py-2.5">United States</td>
              </tr>
              <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">Upstash</td>
                <td className="px-4 py-2.5">Redis cache and background job queue management</td>
                <td className="px-4 py-2.5">Job metadata, session tokens, temporary processing state</td>
                <td className="px-4 py-2.5">United States</td>
              </tr>
              <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">Resend</td>
                <td className="px-4 py-2.5">Transactional email delivery for dunning communications</td>
                <td className="px-4 py-2.5">Recipient email addresses, email subject lines and body content</td>
                <td className="px-4 py-2.5">United States</td>
              </tr>
              <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">Anthropic</td>
                <td className="px-4 py-2.5">AI content generation for personalized dunning emails</td>
                <td className="px-4 py-2.5">Invoice amounts, customer names, company names, days overdue</td>
                <td className="px-4 py-2.5">United States</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">Stripe</td>
                <td className="px-4 py-2.5">Payment processing and billing platform integration</td>
                <td className="px-4 py-2.5">Invoice records, payment amounts, payment method tokens</td>
                <td className="px-4 py-2.5">United States</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">6. International Data Transfers</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          RecoverAI and its Sub-processors primarily process data within the United States. Where Personal Data is transferred to a jurisdiction that does not provide an adequate level of data protection as determined by the European Commission or other relevant authority, RecoverAI ensures that appropriate safeguards are in place. These safeguards include Standard Contractual Clauses (SCCs) approved by the European Commission, supplemented by additional technical measures where necessary. RecoverAI will cooperate with the Customer to execute any additional transfer mechanism documentation required under applicable law.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">7. Data Subject Rights</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          RecoverAI will assist the Customer in fulfilling its obligations to respond to Data Subject requests exercising their rights under applicable data protection laws, including rights of access, rectification, erasure, restriction, portability, and objection. If RecoverAI receives a request directly from a Data Subject, it will promptly redirect the request to the Customer unless legally prohibited from doing so. RecoverAI provides self-service data export and deletion functionality within the Service to facilitate the Customer's compliance with Data Subject requests. The Service also supports email unsubscribe requests, which are processed automatically and prevent further dunning communications to the opted-out Data Subject.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">8. Data Breach Notification</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          In the event of a personal data breach that affects Customer Data, RecoverAI will notify the Customer without undue delay and in any event within 72 hours of becoming aware of the breach. The notification will include the nature of the breach, the categories and approximate number of Data Subjects affected, the likely consequences of the breach, and the measures taken or proposed to address the breach and mitigate its effects. RecoverAI will cooperate with the Customer and take reasonable commercial steps to assist in the investigation, mitigation, and remediation of the breach. RecoverAI will document all breaches, including the facts, effects, and corrective actions taken, and will make this documentation available to the Customer upon request.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">9. Audits and Compliance</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          RecoverAI will make available to the Customer all information reasonably necessary to demonstrate compliance with the obligations set out in this DPA. Upon written request with at least 30 days' advance notice, the Customer may conduct or commission an independent auditor (bound by confidentiality obligations) to conduct an audit of RecoverAI's processing activities and security measures, no more than once per calendar year. RecoverAI will cooperate with such audits and provide reasonable access to relevant facilities, systems, and personnel. Where RecoverAI maintains relevant certifications or third-party audit reports (such as SOC 2 Type II), these may be provided in lieu of a direct audit at RecoverAI's discretion.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">10. Data Retention and Deletion</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Upon termination of the agreement between the Customer and RecoverAI, RecoverAI will, at the Customer's written election, return or delete all Personal Data processed on behalf of the Customer within 30 days, except where retention is required by applicable law or regulation. If the Customer does not provide instructions within 30 days of termination, RecoverAI will delete the Personal Data within 90 days of termination. RecoverAI will certify deletion in writing upon the Customer's request. Aggregated and anonymized data that cannot be used to identify any Data Subject is excluded from this deletion obligation.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">11. Term and Termination</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          This DPA takes effect upon the Customer's acceptance of the Terms of Service and remains in effect for as long as RecoverAI processes Personal Data on behalf of the Customer. The obligations and rights of the Customer and RecoverAI under this DPA survive the termination of the DPA to the extent that RecoverAI continues to process or retain Personal Data on behalf of the Customer. In the event of a conflict between this DPA and the Terms of Service, this DPA shall prevail with respect to matters relating to the processing of Personal Data.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">12. Liability</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          Each party's liability under this DPA is subject to the limitations of liability set forth in the Terms of Service. Nothing in this DPA shall limit either party's liability for breaches of confidentiality obligations, willful misconduct, or obligations that cannot be limited under applicable data protection laws. Each party shall be liable for damage caused by processing that infringes applicable data protection laws, in accordance with the liability allocation mechanisms established by those laws.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">13. Contact Information</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          For questions regarding this DPA or data processing matters, please contact our Data Protection Officer at dpo@recoverai.com or by mail at RecoverAI, Inc., 1209 Orange Street, Wilmington, DE 19801, United States.
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

export default Dpa;

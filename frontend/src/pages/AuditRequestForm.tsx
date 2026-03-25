import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { useNotification } from '../hooks/useNotification';

const AuditRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useNotification();

  const [formData, setFormData] = useState({
    company_name: '',
    email: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate
      if (!formData.company_name.trim()) {
        setError('Company name is required');
        setLoading(false);
        return;
      }

      if (!formData.email.includes('@')) {
        setError('Valid email is required');
        setLoading(false);
        return;
      }

      console.log('📋 Submitting audit request...', formData);

      // Submit form
      const response = await api.post('/api/audit-requests', {
        company_name: formData.company_name,
        email: formData.email,
      });

      console.log('✅ Audit request submitted:', response);

      // Show success message
      setSubmitted(true);
      addToast({
        type: 'success',
        message: 'Request submitted. We\'ll review and send you the audit link within 24 hours',
      });

      // Redirect to landing after 3 seconds
      setTimeout(() => {
        navigate('/landing');
      }, 3000);
    } catch (err: any) {
      console.error('❌ Error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to submit request';
      setError(errorMsg);
      addToast({
        type: 'error',
        message: errorMsg,
      });
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#09090b] dark:to-[#111113] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl">✓</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Request Submitted
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              We'll review and send you the link within 24 hours
            </p>
          </div>

          <div className="bg-white dark:bg-[#111113] rounded-xl shadow-lg border border-gray-200 dark:border-white/[0.06] p-8">
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  We've received your request. Our team will review <strong>{formData.company_name}</strong> and send you an audit link within 24 hours to <strong>{formData.email}</strong>.
                </p>
              </div>

              <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-6">
                Look for an email from hello@recoverai.com with your personal audit link.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#09090b] dark:to-[#111113] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">R</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Analyze Your AR
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            See how much working capital you can free up in 90 days
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-[#111113] rounded-xl shadow-lg border border-gray-200 dark:border-white/[0.06] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleInputChange}
                placeholder="e.g., Acme Inc"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Work Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="you@company.com"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>


            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex gap-2">
                  <div className="text-red-600 dark:text-red-400 font-bold">⚠️</div>
                  <div>
                    <p className="text-sm font-medium text-red-900 dark:text-red-200">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              variant="primary"
              size="lg"
              type="submit"
              loading={loading}
              disabled={loading}
              className="w-full"
            >
              Get Your Audit Link
            </Button>
          </form>

          {/* Footer Text */}
          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-6">
            We'll send you an audit link via email. No credit card required.
          </p>
        </div>

        {/* Security Note */}
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-6">
          Your data is secure. We use read-only access to Stripe and never store your
          financial information.
        </p>
      </div>
    </div>
  );
};

export default AuditRequestForm;

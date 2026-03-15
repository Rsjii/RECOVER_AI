import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotification } from '../hooks/useNotification';
import { Button } from '../components/ui/Button';
import { validateEmail, validatePassword, getPasswordStrength } from '../lib/utils';

const Signup: React.FC = () => {
  useEffect(() => { document.title = 'Sign Up — RecoverAI'; }, []);
  const navigate = useNavigate();
  const { signup } = useAuth();
  const { addToast } = useNotification();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    company_name: '',
  });
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    company_name?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!form.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!form.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!form.company_name.trim()) newErrors.company_name = 'Company name is required';
    if (!form.email) newErrors.email = 'Email is required';
    else if (!validateEmail(form.email)) newErrors.email = 'Enter a valid email';
    if (!form.password) newErrors.password = 'Password is required';
    else if (!validatePassword(form.password))
      newErrors.password = 'Min 8 chars, 1 uppercase, 1 number';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await signup(form.email, form.password, form.company_name, form.firstName, form.lastName);
      addToast({ type: 'success', message: 'Account created! Let\'s set up your integrations.' });
      navigate('/setup');
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Signup failed. Try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const strength = form.password ? getPasswordStrength(form.password) : null;
  const strengthColors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">R</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Start recovering revenue</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Free 2-week trial, no credit card</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  First name
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="John"
                  className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    errors.firstName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.firstName && <p className="mt-1 text-xs text-red-500">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Last name
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Smith"
                  className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                    errors.lastName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.lastName && <p className="mt-1 text-xs text-red-500">{errors.lastName}</p>}
              </div>
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Company name
              </label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="Acme Corp"
                className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.company_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.company_name && <p className="mt-1 text-xs text-red-500">{errors.company_name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Work email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="john@company.com"
                className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
              {strength && form.password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${
                          i < strength.score ? strengthColors[strength.score - 1] : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{strength.message}</p>
                </div>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              disabled={submitting}
              className="w-full"
            >
              Create account
            </Button>

            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              By signing up, you agree to our{' '}
              <Link to="/terms" className="text-blue-600 hover:underline">Terms</Link> and{' '}
              <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
            </p>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;

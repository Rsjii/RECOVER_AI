import React, { useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';

interface ProfileSectionProps {
  onUpdated?: () => void;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({ onUpdated }) => {
  const { user, refresh } = useAuth();
  const { addToast } = useNotification();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      addToast({ type: 'error', message: 'All fields are required' });
      return;
    }

    setLoading(true);
    try {
      await api.put('/api/auth/profile', {
        firstName: form.firstName,
        lastName: form.lastName,
      });
      await refresh();
      addToast({ type: 'success', message: 'Profile updated successfully' });
      onUpdated?.();
    } catch (err: any) {
      addToast({ type: 'error', message: err.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111113] rounded-xl border border-gray-200 dark:border-white/[0.06] p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your account information</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              First name
            </label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm(prev => ({ ...prev, firstName: e.target.value }))}
              placeholder="John"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.1] rounded-lg bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Last name
            </label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm(prev => ({ ...prev, lastName: e.target.value }))}
              placeholder="Smith"
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.1] rounded-lg bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Email address
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-white/[0.1] rounded-lg bg-gray-50 dark:bg-white/[0.04] text-gray-500 dark:text-gray-400 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Contact support to change email</p>
        </div>

        <div className="pt-4">
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            loading={loading}
          >
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
};

import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { useNotification } from '../../hooks/useNotification';
import type { ProfileFormData } from '../../types/settings';

interface ProfileSectionProps {
  data: ProfileFormData;
  onChange: (field: string, value: any) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  isDirty: boolean;
  errors?: Record<string, string>;
}

const TIMEZONE_OPTIONS = [
  { label: 'UTC', value: 'UTC' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'America/Chicago', value: 'America/Chicago' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Paris', value: 'Europe/Paris' },
  { label: 'Asia/Singapore', value: 'Asia/Singapore' },
  { label: 'Asia/Kolkata', value: 'Asia/Kolkata' },
  { label: 'Australia/Sydney', value: 'Australia/Sydney' },
];

export const ProfileSection: React.FC<ProfileSectionProps> = ({
  data,
  onChange,
  onSave,
  isSaving,
  isDirty,
  errors = {},
}) => {
  const { addToast } = useNotification();
  const [logoPreview, setLogoPreview] = useState<string | null>(data.logoUrl || null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast({
        type: 'error',
        message: 'Logo must be less than 2MB',
      });
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      addToast({
        type: 'error',
        message: 'Logo must be PNG or JPG',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const preview = event.target?.result as string;
      setLogoPreview(preview);
      onChange('logoUrl', preview);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      await onSave();
      addToast({
        type: 'success',
        message: 'Profile updated successfully',
      });
    } catch (err) {
      // Error already shown by hook
    }
  };


  return (
    <div className="space-y-8">
      {/* Company Information Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Company Information
        </h3>

        {/* Company Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.companyName}
            onChange={(e) => onChange('companyName', e.target.value)}
            placeholder="Acme Inc"
            maxLength={100}
            className={cn(
              'w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white',
              'bg-white dark:bg-white/[0.03]',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
              errors.companyName ? 'border-red-500' : 'border-gray-300 dark:border-white/[0.08]'
            )}
          />
          {errors.companyName && (
            <p className="mt-1 text-sm text-red-500">{errors.companyName}</p>
          )}
        </div>

        {/* Email */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => onChange('email', e.target.value)}
            placeholder="billing@acme.com"
            className={cn(
              'w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white',
              'bg-white dark:bg-white/[0.03]',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
              errors.email ? 'border-red-500' : 'border-gray-300 dark:border-white/[0.08]'
            )}
          />
          {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
        </div>

        {/* Timezone */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Timezone <span className="text-red-500">*</span>
          </label>
          <select
            value={data.timezone}
            onChange={(e) => onChange('timezone', e.target.value)}
            className={cn(
              'w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white',
              'bg-white dark:bg-white/[0.03]',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
              errors.timezone ? 'border-red-500' : 'border-gray-300 dark:border-white/[0.08]'
            )}
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Used for scheduling emails and Slack digests
          </p>
        </div>
      </div>

      {/* Branding Section */}
      <div className="border-t border-gray-200 dark:border-white/[0.06] pt-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          Branding
        </h3>

        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Logo <span className="text-gray-500 text-xs">(Optional)</span>
          </label>
          <div className="mb-4">
            <div className="relative border-2 border-dashed border-gray-300 dark:border-white/[0.08] rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-white/[0.12] transition-colors">
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleLogoChange}
                className="hidden"
                id="logo-upload"
              />
              <label htmlFor="logo-upload" className="cursor-pointer">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-blue-600 dark:text-blue-400">Upload a logo</span>{' '}
                  or drag and drop
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  PNG or JPG, Max 2MB
                </p>
              </label>
            </div>
          </div>

          {/* Logo Preview */}
          {logoPreview && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preview
              </p>
              <div className="p-4 bg-gray-100 dark:bg-white/[0.05] rounded-lg">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="h-24 object-contain mx-auto"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-white/[0.06] pt-8">
        <button
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            'bg-gray-200 text-gray-900 dark:bg-white/[0.08] dark:text-white',
            'hover:bg-gray-300 dark:hover:bg-white/[0.12]',
            !isDirty && 'opacity-50 cursor-not-allowed'
          )}
          disabled={!isDirty || isSaving}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className={cn(
            'px-4 py-2 rounded-lg font-medium transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

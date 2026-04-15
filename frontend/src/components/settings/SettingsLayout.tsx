import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { ConfirmationModal } from '../ui/ConfirmationModal';

export type SettingsTab = 'integrations' | 'email' | 'sms' | 'account';

interface SettingsLayoutProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onCancel?: () => void;
  children: React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  activeTab,
  onTabChange,
  isDirty,
  isLoading,
  isSaving,
  onCancel,
  children,
}) => {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [pendingTab, setPendingTab] = useState<SettingsTab | null>(null);

  const TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
    {
      id: 'integrations',
      label: 'Integrations',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      ),
    },
    {
      id: 'email',
      label: 'Email Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      id: 'sms',
      label: 'SMS Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 16h8m-4-4h4m-8 8h12a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      id: 'account',
      label: 'Account',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
  ];

  const handleTabChange = (tab: SettingsTab) => {
    if (isDirty) {
      setPendingTab(tab);
      setShowDiscardConfirm(true);
      return;
    }
    onTabChange(tab);
  };

  const confirmDiscard = () => {
    onCancel?.();
    if (pendingTab) {
      onTabChange(pendingTab);
      setPendingTab(null);
    }
    setShowDiscardConfirm(false);
  };

  return (
    <>
      <ConfirmationModal
        isOpen={showDiscardConfirm}
        title="Discard changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        isDangerous={true}
        onConfirm={confirmDiscard}
        onCancel={() => {
          setShowDiscardConfirm(false);
          setPendingTab(null);
        }}
      />

      <div className="min-h-screen bg-gray-50 dark:bg-[#09090b]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account, integrations, and automation rules
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 border-b border-gray-200 dark:border-white/[0.06] overflow-x-auto sm:scrollbar-show">
          <div className="flex gap-2 sm:gap-4 flex-nowrap">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                disabled={isLoading || isSaving}
                className={cn(
                  'flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm whitespace-nowrap',
                  'border-b-2 transition-colors duration-200',
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                <span className="inline-flex flex-shrink-0">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Unsaved Changes Warning */}
        {isDirty && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              You have unsaved changes. Click the Save button to save them.
            </p>
          </div>
        )}

        {/* Tab Content */}
        <div className="bg-white dark:bg-[#111113] rounded-xl shadow-sm border border-gray-200 dark:border-white/[0.06] p-4 sm:p-8">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="text-center">
                <div className="inline-flex animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading settings...</p>
              </div>
            </div>
          ) : (
            children
          )}
        </div>

        {/* Bottom Action Bar */}
        {!isLoading && (
          <div className="flex justify-between items-center gap-4 mt-8">
            <div>
              {isSaving && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="inline-flex animate-spin h-4 w-4 border-2 border-gray-400 border-r-transparent rounded-full mr-2"></span>
                  Saving...
                </p>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
};

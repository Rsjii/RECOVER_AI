import React, { useEffect, useState } from 'react';
import { SettingsLayout } from '../components/settings/SettingsLayout';
import { useSettings } from '../components/settings/useSettings';
import { useNotification } from '../hooks/useNotification';
import { ProfileSection } from '../components/settings/ProfileSection';
import { IntegrationSection } from '../components/settings/IntegrationSection';
import { EmailSettingsSection } from '../components/settings/EmailSettingsSection';
import { DunningSection } from '../components/settings/DunningSection';
import { AutomationSection } from '../components/settings/AutomationSection';
import { AccountSection } from '../components/settings/AccountSection';
import type { SettingsTab } from '../components/settings/SettingsLayout';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const { addToast } = useNotification();
  const { user } = useAuth();
  const {
    formData,
    isDirty,
    isLoading,
    isSaving,
    integrations,
    sessions,
    updateField,
    save,
    refetchIntegrations,
  } = useSettings();

  useEffect(() => {
    document.title = 'Settings — RecoverAI';

    // Handle OAuth callback from integrations
    const params = new URLSearchParams(window.location.search);

    // Check for standard pattern: ?oauth_success=true&integration=stripe
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    const integrationType = params.get('integration');

    // Check for QB pattern: ?qb=connected
    const qbConnected = params.get('qb') === 'connected';
    const qbError = params.get('qb_error');

    let shouldRefresh = false;
    let integrationName = '';
    let errorMsg = '';

    if (oauthSuccess && integrationType) {
      shouldRefresh = true;
      integrationName = integrationType;
    } else if (oauthError && integrationType) {
      errorMsg = `Failed to connect ${integrationType}: ${oauthError}`;
    } else if (qbConnected) {
      shouldRefresh = true;
      integrationName = 'QuickBooks';
    } else if (qbError) {
      errorMsg = `Failed to connect QuickBooks: ${qbError}`;
    }

    if (shouldRefresh) {
      addToast({
        type: 'success',
        message: `${integrationName} connected successfully! Syncing data...`,
      });
      setActiveTab('integrations');

      // Give a moment for backend to finalize, then refresh
      setTimeout(() => {
        refetchIntegrations();

        // Trigger QB data sync if QB just connected
        if (integrationName === 'QuickBooks') {
          api.post('/api/quickbooks/sync')
            .then(() => {
              addToast({
                type: 'success',
                message: 'QuickBooks data synced successfully!',
              });
              refetchIntegrations(); // Refresh again after sync
            })
            .catch((err) => {
              console.error('QB sync failed:', err);
              addToast({
                type: 'error',
                message: 'QB connected but sync failed. Try manual sync from dashboard.',
              });
            });
        }
      }, 1000);

      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorMsg) {
      addToast({
        type: 'error',
        message: errorMsg,
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [addToast, refetchIntegrations]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
  };

  const handleSave = async () => {
    await save();
  };

  const handleDisconnectIntegration = async (type: string) => {
    try {
      await api.post(`/api/settings/integrations/${type}/disconnect`);
      addToast({
        type: 'success',
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} disconnected`,
      });
      refetchIntegrations();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || `Failed to disconnect ${type}`,
      });
    }
  };

  const handleSessionsRefresh = async () => {
    // Refetch settings to update sessions list
    // useSettings hook will update sessions state automatically
  };

  return (
    <SettingsLayout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      isDirty={isDirty}
      isLoading={isLoading}
      isSaving={isSaving}
    >
      {/* Profile Tab - Company Info Only */}
      {activeTab === 'profile' && (
        <ProfileSection
          data={formData.profile}
          onChange={(field, value) => updateField('profile', field, value)}
          onSave={handleSave}
          isSaving={isSaving}
          isDirty={isDirty}
        />
      )}

      {/* Integrations Tab - Read-Only Status View */}
      {activeTab === 'integrations' && (
        <IntegrationSection
          integrations={integrations}
          onDisconnect={handleDisconnectIntegration}
          onRefetch={refetchIntegrations}
        />
      )}

      {/* Email Settings Tab - Sender, Tone, Signature */}
      {activeTab === 'email' && (
        <EmailSettingsSection
          data={formData.email}
          onChange={(field, value) => updateField('email', field, value)}
          onSave={handleSave}
          isSaving={isSaving}
          isDirty={isDirty}
        />
      )}

      {/* Dunning Settings Tab - Email Timing, Auto-Pause, Payment Splits */}
      {activeTab === 'dunning' && (
        <DunningSection
          data={formData.dunning}
          onChange={(field, value) => updateField('dunning', field, value)}
          onSave={handleSave}
          isSaving={isSaving}
          isDirty={isDirty}
        />
      )}

      {/* Automation Tab - Email Queue, Workflows, Advanced */}
      {activeTab === 'automation' && (
        <AutomationSection />
      )}

      {/* Account Tab - Password Reset, Security, Account Management, Sessions */}
      {activeTab === 'account' && (
        <AccountSection
          userEmail={user?.email}
          authProvider={user?.authProvider || 'email'}
          sessions={sessions}
          onSessionsRefresh={handleSessionsRefresh}
        />
      )}
    </SettingsLayout>
  );
};

export default Settings;

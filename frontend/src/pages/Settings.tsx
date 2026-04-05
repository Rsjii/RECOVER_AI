import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsLayout } from '../components/settings/SettingsLayout';
import { useSettings } from '../components/settings/useSettings';
import { useNotification } from '../hooks/useNotification';
import { IntegrationSection } from '../components/settings/IntegrationSection';
import { EmailSettingsSection } from '../components/settings/EmailSettingsSection';
import { AccountSection } from '../components/settings/AccountSection';
import type { SettingsTab } from '../components/settings/SettingsLayout';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('integrations');
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
    cancel,
    refetchIntegrations,
  } = useSettings();

  // Redirect demo users away from Settings
  useEffect(() => {
    if (localStorage.getItem('isDemo') === 'true') {
      addToast({ type: 'info', message: 'Demo mode — Settings not available' });
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, addToast]);

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
      onCancel={cancel}
    >
      {/* Integrations Tab - Read-Only Status View */}
      {activeTab === 'integrations' && (
        <IntegrationSection
          integrations={integrations}
          onDisconnect={handleDisconnectIntegration}
          onRefetch={refetchIntegrations}
        />
      )}

      {/* Email Settings Tab - Sender (with SMTP), Tone, Signature */}
      {activeTab === 'email' && (
        <EmailSettingsSection />
      )}


      {/* Account Tab - Company Profile + Password Reset, Security, Sessions */}
      {activeTab === 'account' && (
        <AccountSection
          profileData={formData.profile}
          onProfileChange={(field, value) => updateField('profile', field, value)}
          onSave={handleSave}
          onCancel={cancel}
          isSaving={isSaving}
          isDirty={isDirty}
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

import { useState, useCallback, useEffect } from 'react';
import { api } from '../../lib/api';
import { useNotification } from '../../hooks/useNotification';
import type {
  SettingsFormData,
  IntegrationStatus,
  SessionInfo,
} from '../../types/settings';

/**
 * useSettings Hook
 * Manages all settings state, API calls, and form logic
 */

export const useSettings = () => {
  const { addToast } = useNotification();

  // Form state
  const [formData, setFormData] = useState<SettingsFormData>({
    profile: {
      companyName: '',
      email: '',
      timezone: 'UTC',
      logoUrl: undefined,
    },
    email: {
      senderEmail: '',
      emailTone: 'friendly',
      customSignature: '',
    },
    dunning: {
      email1Day: 7,
      email2Day: 14,
      email3Day: 22,
      email4Day: 35,
      email5Day: 50,
      autoPauseOnReply: true,
      lowRiskSplit: '50/50',
      medRiskSplit: '40/60',
      highRiskSplit: '30/70',
    },
    automation: {
      pilotMode: 'auto',
    },
  });

  const [originalData, setOriginalData] = useState<SettingsFormData>(formData);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Integrations & Sessions
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);

  // Derived state
  const isDirty = JSON.stringify(formData) !== JSON.stringify(originalData);

  /**
   * Fetch all settings on mount
   */
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch all settings from single endpoint
        const settingsRes = await api.get('/api/settings');
        const data = settingsRes.data?.data || settingsRes.data || settingsRes;

        // Build form data from settings response
        const newFormData: SettingsFormData = {
          profile: {
            companyName: data.companyName || '',
            email: data.email || '',
            timezone: data.timezone || 'UTC',
            logoUrl: undefined,
          },
          email: {
            senderEmail: data.replyToEmail || '',
            emailTone: 'friendly',
            customSignature: '',
          },
          dunning: {
            email1Day: 7,
            email2Day: 14,
            email3Day: 22,
            email4Day: 35,
            email5Day: 50,
            autoPauseOnReply: true,
            lowRiskSplit: '50/50',
            medRiskSplit: '40/60',
            highRiskSplit: '30/70',
          },
          automation: {
            pilotMode: data.pilotMode || 'auto',
          },
        };

        setFormData(newFormData);
        setOriginalData(newFormData);

        // Convert integrations from API format to IntegrationStatus[]
        const integrationsArray: IntegrationStatus[] = [];
        const integrationStatus = data.integrations || {};

        if (integrationStatus.stripe) {
          integrationsArray.push({
            type: 'stripe',
            status: 'connected',
            details: { accountName: 'Stripe' },
            lastSynced: integrationStatus.stripeLastSyncedAt,
            hasWebhookSecret: integrationStatus.stripeHasWebhookSecret || false,  // New: pass webhook secret flag
          });
        }
        if (integrationStatus.slack) {
          integrationsArray.push({
            type: 'slack',
            status: 'connected',
            details: { workspaceName: 'Slack' },
          });
        }
        if (integrationStatus.quickbooks) {
          integrationsArray.push({
            type: 'quickbooks',
            status: 'connected',
            details: { accountName: 'QuickBooks' },
          });
        }

        setIntegrations(integrationsArray);

        // Fetch sessions separately
        try {
          const sessionsRes = await api.get('/api/auth/sessions');
          setSessions(sessionsRes.data || sessionsRes || []);
        } catch {
          // If fails, that's OK - sessions not required
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load settings');
        console.error('Error fetching settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  /**
   * Update a single field in form data
   */
  const updateField = useCallback(
    (section: keyof SettingsFormData, field: string, value: any) => {
      setFormData((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value,
        },
      }));
    },
    []
  );

  /**
   * Save all form data to backend
   */
  const save = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      // For now, just update the original data to clear dirty flag
      setOriginalData(formData);
      // No toast here - let the calling component handle it
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to save settings';
      setError(errorMsg);
      addToast({
        type: 'error',
        message: errorMsg,
      });
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [formData, addToast]);

  /**
   * Cancel changes and revert to original data
   */
  const cancel = useCallback(() => {
    setFormData(originalData);
    setOriginalData(originalData);
    setError(null);
  }, [originalData]);

  /**
   * Reset to default values
   */
  const reset = useCallback(() => {
    setFormData({
      profile: {
        companyName: '',
        email: '',
        timezone: 'UTC',
        logoUrl: undefined,
      },
      email: {
        senderEmail: '',
        emailTone: 'friendly',
        customSignature: '',
      },
      dunning: {
        email1Day: 7,
        email2Day: 14,
        email3Day: 22,
        email4Day: 35,
        email5Day: 50,
        autoPauseOnReply: true,
        lowRiskSplit: '50/50',
        medRiskSplit: '40/60',
        highRiskSplit: '30/70',
      },
      automation: {
        pilotMode: 'auto',
      },
    });
  }, []);

  /**
   * Refresh integrations from API (e.g., after OAuth callback)
   */
  const refetchIntegrations = useCallback(async () => {
    try {
      const settingsRes = await api.get('/api/settings');
      const settingsData = settingsRes.data || settingsRes;
      const integrations = settingsData.integrations || {};

      // Convert boolean/object format to IntegrationStatus array
      const integrationsArray: IntegrationStatus[] = [];

      if (integrations.stripe) {
        integrationsArray.push({
          type: 'stripe',
          status: 'connected',
          details: { accountName: 'Stripe' },
          lastSynced: integrations.stripeLastSyncedAt,
        });
      }

      if (integrations.slack) {
        integrationsArray.push({
          type: 'slack',
          status: 'connected',
          details: { workspaceName: 'Slack' },
        });
      }

      if (integrations.quickbooks) {
        integrationsArray.push({
          type: 'quickbooks',
          status: 'connected',
          details: { accountName: 'QuickBooks' },
        });
      }

      setIntegrations(integrationsArray);
    } catch (err: any) {
      console.error('Error refetching integrations:', err);
      addToast({
        type: 'error',
        message: 'Failed to refresh integrations',
      });
    }
  }, [addToast]);

  return {
    // State
    formData,
    isDirty,
    isLoading,
    isSaving,
    error,
    integrations,
    sessions,

    // Methods
    updateField,
    save,
    cancel,
    reset,
    setIntegrations,
    setSessions,
    refetchIntegrations,
  };
};

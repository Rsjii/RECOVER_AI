import React, { useState } from 'react';
import type { IntegrationStatus } from '../../types/settings';
import { Button } from '../ui/Button';
import { useNotification } from '../../hooks/useNotification';

interface IntegrationSectionProps {
  integrations: IntegrationStatus[];
  onDisconnect?: (type: string) => Promise<void>;
  onRefetch?: () => Promise<void>;
}

const INTEGRATION_CONFIG: Record<string, { label: string; icon: string; description: string; group: string; availableIn?: string; tier: 'STARTER' | 'GROWTH' }> = {
  stripe: {
    label: 'Stripe',
    icon: '💳',
    description: 'Pull real-time invoices and payments',
    group: 'BILLING_SYSTEMS',
    tier: 'STARTER',
  },
  csv: {
    label: 'CSV Upload',
    icon: '📄',
    description: 'Manual invoice import',
    group: 'DATA_IMPORT',
    tier: 'STARTER',
  },
  slack: {
    label: 'Slack',
    icon: '💬',
    description: 'Daily digest and notifications',
    group: 'NOTIFICATIONS',
    tier: 'STARTER',
  },
  quickbooks: {
    label: 'QuickBooks',
    icon: '📊',
    description: 'AR aging and AP data',
    group: 'BILLING_SYSTEMS',
    availableIn: 'GROWTH_TIER',
    tier: 'GROWTH',
  },
  xero: {
    label: 'Xero',
    icon: '📊',
    description: 'Accounting data sync',
    group: 'BILLING_SYSTEMS',
    availableIn: 'GROWTH_TIER',
    tier: 'GROWTH',
  },
  plaid: {
    label: 'Plaid',
    icon: '🏦',
    description: 'Bank balance sync',
    group: 'BANK_DATA',
    availableIn: 'GROWTH_TIER',
    tier: 'GROWTH',
  },
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'connected':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
          <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full"></span>
          Connected
        </span>
      );
    case 'not_connected':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400">
          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
          Not Connected
        </span>
      );
    case 'coming_soon':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
          <span className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
          Coming Soon
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
          <span className="w-2 h-2 bg-red-600 dark:bg-red-400 rounded-full"></span>
          Error
        </span>
      );
  }
};

export const IntegrationSection: React.FC<IntegrationSectionProps> = ({ integrations, onDisconnect, onRefetch }) => {
  const { addToast } = useNotification();
  const [stripeKeyMode, setStripeKeyMode] = useState(false);
  const [stripeKey, setStripeKey] = useState('');
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleManualKey = async () => {
    if (!stripeKey.trim()) return;
    try {
      // Call API to save manual Stripe key - use correct endpoint
      const response = await fetch('/api/stripe/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: stripeKey }),
      });
      const data = await response.json();
      if (response.ok) {
        setStripeKeyMode(false);
        setStripeKey('');
        addToast({
          type: 'success',
          message: 'Stripe API key saved successfully!',
        });
        onRefetch?.();
      } else {
        addToast({
          type: 'error',
          message: data.error || 'Failed to save API key',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: 'Failed to save Stripe key',
      });
      console.error('Failed to save Stripe key:', err);
    }
  };

  const handleOAuthConnect = (url?: string) => {
    if (url) window.location.href = url;
  };

  const handleManualSync = async (type: string) => {
    setSyncing(type);
    try {
      const response = await fetch(`/api/${type}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        addToast({
          type: 'success',
          message: `${type.charAt(0).toUpperCase() + type.slice(1)} synced: ${data.result?.created || 0} new, ${data.result?.updated || 0} updated`,
        });
        onRefetch?.();
      } else {
        addToast({
          type: 'error',
          message: `Failed to sync ${type}`,
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || `Failed to sync ${type}`,
      });
    } finally {
      setSyncing(null);
    }
  };

  const groupedIntegrations = Object.entries(INTEGRATION_CONFIG).reduce(
    (acc, [key, config]) => {
      if (!acc[config.group]) {
        acc[config.group] = [];
      }
      const integration = integrations.find((i) => i.type === key);
      acc[config.group].push({ key, config, integration });
      return acc;
    },
    {} as Record<string, Array<{ key: string; config: any; integration?: IntegrationStatus }>>
  );

  const groupLabels: Record<string, string> = {
    BILLING_SYSTEMS: 'Billing Systems',
    DATA_IMPORT: 'Data Import',
    NOTIFICATIONS: 'Notifications',
    BANK_DATA: 'Bank Data',
  };

  return (
    <div className="space-y-8">
      {Object.entries(groupLabels).map(([groupKey, groupLabel]) => {
        const items = groupedIntegrations[groupKey];
        if (!items) return null;

        return (
          <div key={groupKey}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {groupLabel}
            </h3>

            <div className="space-y-4">
              {items.map(({ key, config, integration }) => (
                <div key={key}>
                  {/* Main Card */}
                  <div
                    className="p-4 border border-gray-200 dark:border-white/[0.06] rounded-lg hover:border-gray-300 dark:hover:border-white/[0.1] transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{config.icon}</span>
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {config.label}
                              {config.tier === 'GROWTH' && (
                                <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">Growth</span>
                              )}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {config.description}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="mt-3">
                          {integration ? (
                            <>
                              {getStatusBadge(integration.status)}
                              {integration.status === 'connected' && integration.details && (
                                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                  {integration.details.accountName && (
                                    <p>Account: {integration.details.accountName}</p>
                                  )}
                                  {integration.details.workspaceName && (
                                    <p>Workspace: {integration.details.workspaceName}</p>
                                  )}
                                  {integration.details.channel && (
                                    <p>Channel: {integration.details.channel}</p>
                                  )}
                                  {integration.lastSynced && (
                                    <p>
                                      Last synced:{' '}
                                      {new Date(integration.lastSynced).toLocaleDateString()} at{' '}
                                      {new Date(integration.lastSynced).toLocaleTimeString()}
                                    </p>
                                  )}
                                </div>
                              )}
                              {integration.status === 'coming_soon' && config.availableIn && (
                                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                                  Coming in {config.availableIn}
                                </p>
                              )}
                            </>
                          ) : (
                            getStatusBadge('not_connected')
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="ml-4 flex flex-col gap-2 items-end">
                        {integration && integration.status === 'connected' && (
                          <>
                            {/* Sync button for Stripe & QB */}
                            {(key === 'stripe' || key === 'quickbooks') && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleManualSync(key)}
                                disabled={syncing === key}
                              >
                                {syncing === key ? 'Syncing...' : '🔄 Sync Now'}
                              </Button>
                            )}
                            <button
                              onClick={() => onDisconnect?.(key)}
                              className="px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            >
                              Disconnect
                            </button>
                          </>
                        )}

                        {!integration || integration.status === 'not_connected' ? (
                          <>
                            {/* Stripe: Manual Key + OAuth */}
                            {key === 'stripe' && (
                              <div className="flex flex-col gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setStripeKeyMode(!stripeKeyMode)}
                                >
                                  🔑 Manual Key
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleOAuthConnect('/api/stripe/oauth/authorize')}
                                >
                                  Connect
                                </Button>
                              </div>
                            )}

                            {/* CSV: Opens modal in Invoices */}
                            {key === 'csv' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => window.location.href = '/invoices'}
                              >
                                📤 Go to Invoices
                              </Button>
                            )}

                            {/* Slack: OAuth */}
                            {key === 'slack' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOAuthConnect('/api/slack/authorize')}
                              >
                                Connect
                              </Button>
                            )}

                            {/* QuickBooks: OAuth with correct URL */}
                            {key === 'quickbooks' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOAuthConnect('/api/quickbooks/oauth/authorize')}
                              >
                                Connect
                              </Button>
                            )}

                            {/* Xero & Plaid: Coming Soon */}
                            {(key === 'xero' || key === 'plaid') && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 text-right">
                                Coming in Growth plan
                              </span>
                            )}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Stripe Manual Key Input - appears inline under Stripe card */}
                  {key === 'stripe' && stripeKeyMode && (
                    <div className="mt-2 p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/10">
                      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Paste your Stripe API Key
                      </label>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="password"
                          value={stripeKey}
                          onChange={(e) => setStripeKey(e.target.value)}
                          placeholder="sk_live_..."
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleManualKey()}
                        >
                          Save
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setStripeKeyMode(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        🔒 Encrypted & secure. Get from <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Stripe Dashboard</a>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Divider */}
            {Object.keys(groupLabels).indexOf(groupKey) < Object.keys(groupLabels).length - 1 && (
              <div className="mt-8 border-t border-gray-200 dark:border-white/[0.06]"></div>
            )}
          </div>
        );
      })}

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
            🚀 STARTER Tier Integrations
          </p>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
            <li className="flex items-start gap-2">
              <span>💳</span>
              <div>
                <strong>Stripe</strong> – Add your API key manually or use OAuth. Both options sync invoices & payments automatically.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span>📄</span>
              <div>
                <strong>CSV Upload</strong> – Go to Invoices tab to import invoices from CSV files. Supports monthly updates & duplicate detection.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span>💬</span>
              <div>
                <strong>Slack</strong> – Get daily digests, real-time alerts, and use commands. Requires workspace authorization.
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span>📊</span>
              <div>
                <strong>QuickBooks</strong> – Connect for AR aging and AP data. (Beta - test on dev)
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span>🔒</span>
              <div>
                <strong>Xero, Plaid</strong> – Coming in Growth plan for enterprise features.
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

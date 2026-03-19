import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';
import { API_ENDPOINTS } from '../../lib/constants';
import { useNotification } from '../../hooks/useNotification';
import { SyncResultModal } from './SyncResultModal';

interface SkippedDetail {
  stripeInvoiceId: string;
  customerName?: string;
  amount?: number;
  reason: 'NO_EMAIL' | 'ZERO_AMOUNT';
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  skippedDetails: SkippedDetail[];
}

interface IntegrationSectionProps {
  stripeConnected: boolean;
  stripeLastSyncedAt?: string | null;
  slackConnected: boolean;
  quickbooksConnected: boolean;
  chargebeeConnected: boolean;
  onRefresh: () => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const IntegrationSection: React.FC<IntegrationSectionProps> = ({
  stripeConnected,
  stripeLastSyncedAt,
  slackConnected,
  quickbooksConnected,
  chargebeeConnected,
  onRefresh,
}) => {
  const { addToast } = useNotification();
  const [stripeKey, setStripeKey] = useState('');
  const [cbSite, setCbSite] = useState('');
  const [cbApiKey, setCbApiKey] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);

  const handleStripeOAuth = () => {
    const clientId = import.meta.env.VITE_STRIPE_CLIENT_ID;
    if (!clientId) { addToast({ type: 'error', message: 'Stripe Client ID not configured' }); return; }
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'read_write',
      redirect_uri: 'http://localhost:3000/api/stripe/oauth/exchange',
      state: 'settings',
    });
    window.location.href = `https://connect.stripe.com/oauth/v2/authorize?${params.toString()}`;
  };

  const handleStripeConnect = async () => {
    if (!stripeKey.trim()) { addToast({ type: 'error', message: 'Enter your Stripe API key' }); return; }
    setConnecting('stripe');
    try {
      await api.post(API_ENDPOINTS.stripe.connect, { stripe_api_key: stripeKey });
      addToast({ type: 'success', message: 'Stripe connected!' });
      setStripeKey('');
      onRefresh();
    } catch (err: any) { addToast({ type: 'error', message: err.message || 'Connection failed' }); }
    finally { setConnecting(null); }
  };

  const handleStripeSync = async () => {
    setSyncing('stripe');
    try {
      const response = await api.post<{ message: string; result: SyncResult }>(API_ENDPOINTS.stripe.sync);
      setSyncResult(response.result);
    } catch (err: any) { addToast({ type: 'error', message: err.message || 'Sync failed' }); }
    finally { setSyncing(null); }
  };

  const handleQBConnect = () => {
    // Redirect to QB OAuth flow
    window.location.href = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/quickbooks/oauth/authorize`;
  };

  const handleQBSync = async () => {
    setSyncing('qb');
    try {
      await api.post('/api/quickbooks/sync');
      addToast({ type: 'success', message: 'Invoices synced from QuickBooks' });
    } catch (err: any) { addToast({ type: 'error', message: err.message || 'QB sync failed' }); }
    finally { setSyncing(null); }
  };

  const handleQBDisconnect = async () => {
    setConnecting('qb-disconnect');
    try {
      await api.delete('/api/quickbooks/disconnect');
      addToast({ type: 'success', message: 'QuickBooks disconnected' });
      onRefresh();
    } catch (err: any) { addToast({ type: 'error', message: err.message || 'Failed to disconnect' }); }
    finally { setConnecting(null); }
  };

  const handleChargebeeConnect = async () => {
    if (!cbSite.trim() || !cbApiKey.trim()) {
      addToast({ type: 'error', message: 'Enter Chargebee site and API key' });
      return;
    }
    setConnecting('chargebee');
    try {
      await api.post('/api/chargebee/connect', { site: cbSite.trim(), apiKey: cbApiKey.trim() });
      addToast({ type: 'success', message: 'Chargebee connected!' });
      setCbSite('');
      setCbApiKey('');
      onRefresh();
    } catch (err: any) { addToast({ type: 'error', message: err.message || 'Chargebee connection failed' }); }
    finally { setConnecting(null); }
  };

  const handleChargebeeSync = async () => {
    setSyncing('chargebee');
    try {
      await api.post('/api/chargebee/sync');
      addToast({ type: 'success', message: 'Invoices synced from Chargebee' });
    } catch (err: any) { addToast({ type: 'error', message: err.message || 'Chargebee sync failed' }); }
    finally { setSyncing(null); }
  };

  const handleChargebeeDisconnect = async () => {
    setConnecting('cb-disconnect');
    try {
      await api.delete('/api/chargebee/disconnect');
      addToast({ type: 'success', message: 'Chargebee disconnected' });
      onRefresh();
    } catch (err: any) { addToast({ type: 'error', message: err.message || 'Failed to disconnect' }); }
    finally { setConnecting(null); }
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Integrations</h3>

      {!stripeConnected && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <details className="cursor-pointer" open={expandedGuide === 'stripe'} onChange={(e) => setExpandedGuide(e.currentTarget.open ? 'stripe' : null)}>
            <summary className="font-medium text-blue-900 dark:text-blue-300 flex items-center justify-between">
              <span>How to connect Stripe?</span>
              <svg className="w-5 h-5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-3 text-sm text-blue-800 dark:text-blue-200 space-y-2">
              <p><strong>Option 1: OAuth (Recommended)</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Click "Connect with Stripe OAuth" below</li>
                <li>Authorize RecoverAI to access your Stripe account</li>
                <li>You'll be redirected back automatically</li>
              </ol>
              <p className="mt-3"><strong>Option 2: API Key</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to Stripe Dashboard → Developers → API keys</li>
                <li>Copy your Secret Key (starts with sk_live_)</li>
                <li>Paste it in the field below and click "Save Key"</li>
              </ol>
            </div>
          </details>
        </div>
      )}

      <div className="space-y-4">

        {/* Stripe */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/[0.06] rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <span className="text-purple-600 font-bold">S</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Stripe</p>
              <p className="text-xs text-gray-500">
                {stripeConnected
                  ? stripeLastSyncedAt
                    ? `Last synced ${timeAgo(stripeLastSyncedAt)}`
                    : 'Connected — never synced'
                  : 'Not connected'}
              </p>
            </div>
          </div>
          {stripeConnected ? (
            <div className="flex items-center gap-2">
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full">Connected</span>
              <Button size="sm" variant="secondary" onClick={handleStripeSync} loading={syncing === 'stripe'}>Sync Now</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 items-end">
              <Button size="sm" variant="primary" onClick={handleStripeOAuth}>Connect with Stripe OAuth</Button>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-gray-400">or</span>
                <input type="password" value={stripeKey} onChange={e => setStripeKey(e.target.value)}
                  placeholder="sk_live_..." className="px-3 py-1.5 border border-gray-300 dark:border-white/[0.1] rounded-lg bg-white dark:bg-white/[0.06] text-sm text-gray-900 dark:text-white w-44" />
                <Button size="sm" variant="secondary" onClick={handleStripeConnect} loading={connecting === 'stripe'}>Save Key</Button>
              </div>
            </div>
          )}
        </div>

        {/* QuickBooks */}
        <div className="p-4 bg-gray-50 dark:bg-white/[0.06] rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <span className="text-green-600 font-bold text-sm">QB</span>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">QuickBooks</p>
                <p className="text-xs text-gray-500">{quickbooksConnected ? 'Connected via OAuth' : 'Not connected'}</p>
              </div>
            </div>
            {quickbooksConnected ? (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full">Connected</span>
                <Button size="sm" variant="secondary" onClick={handleQBSync} loading={syncing === 'qb'}>Sync Now</Button>
                <Button size="sm" variant="secondary" onClick={handleQBDisconnect} loading={connecting === 'qb-disconnect'}>Disconnect</Button>
              </div>
            ) : (
              <Button size="sm" onClick={handleQBConnect}>Connect with QuickBooks</Button>
            )}
          </div>
        </div>

        {/* Chargebee */}
        <div className="p-4 bg-gray-50 dark:bg-white/[0.06] rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <span className="text-orange-600 font-bold text-sm">CB</span>
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Chargebee</p>
                <p className="text-xs text-gray-500">{chargebeeConnected ? 'Connected' : 'Not connected'}</p>
              </div>
            </div>
            {chargebeeConnected ? (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full">Connected</span>
                <Button size="sm" variant="secondary" onClick={handleChargebeeSync} loading={syncing === 'chargebee'}>Sync Now</Button>
                <Button size="sm" variant="secondary" onClick={handleChargebeeDisconnect} loading={connecting === 'cb-disconnect'}>Disconnect</Button>
              </div>
            ) : (
              <div className="flex gap-2 items-center flex-wrap mt-2">
                <input type="text" value={cbSite} onChange={e => setCbSite(e.target.value)}
                  placeholder="your-site" className="px-3 py-1.5 border border-gray-300 dark:border-white/[0.1] rounded-lg bg-white dark:bg-white/[0.06] text-sm text-gray-900 dark:text-white w-32" />
                <span className="text-xs text-gray-400">.chargebee.com</span>
                <input type="password" value={cbApiKey} onChange={e => setCbApiKey(e.target.value)}
                  placeholder="API Key" className="px-3 py-1.5 border border-gray-300 dark:border-white/[0.1] rounded-lg bg-white dark:bg-white/[0.06] text-sm text-gray-900 dark:text-white w-40" />
                <Button size="sm" onClick={handleChargebeeConnect} loading={connecting === 'chargebee'}>Connect</Button>
              </div>
            )}
          </div>
        </div>

        {/* Slack */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/[0.06] rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="text-blue-600 font-bold">#</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Slack</p>
              <p className="text-xs text-gray-500">{slackConnected ? 'Active' : 'Configure below'}</p>
            </div>
          </div>
          {slackConnected
            ? <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full">Active</span>
            : <span className="text-xs text-gray-500">Set webhook below</span>}
        </div>

      </div>

      {syncResult && (
        <SyncResultModal
          result={syncResult}
          onClose={() => { setSyncResult(null); onRefresh(); }}
        />
      )}
    </Card>
  );
};

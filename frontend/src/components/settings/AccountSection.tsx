import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { useNotification } from '../../hooks/useNotification';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { SessionInfo } from '../../types/settings';

interface AccountSectionProps {
  userEmail?: string;
  authProvider?: 'email' | 'google' | 'both';
  sessions?: SessionInfo[];
  onSessionsRefresh?: () => Promise<void>;
}

export const AccountSection: React.FC<AccountSectionProps> = ({
  userEmail,
  authProvider = 'email',
  sessions = [],
  onSessionsRefresh = async () => {}
}) => {
  const { addToast } = useNotification();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [showRevokeAllConfirm, setShowRevokeAllConfirm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
  };

  const getDeviceInfo = (userAgent: string): { type: string; icon: string } => {
    if (userAgent.includes('Chrome')) return { type: 'Chrome', icon: '🌐' };
    if (userAgent.includes('Firefox')) return { type: 'Firefox', icon: '🦊' };
    if (userAgent.includes('Safari')) return { type: 'Safari', icon: '🧭' };
    if (userAgent.includes('Mobile') || userAgent.includes('iPhone')) return { type: 'Mobile', icon: '📱' };
    return { type: 'Unknown', icon: '💻' };
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await api.delete(`/api/auth/sessions/${sessionId}`);
      addToast({
        type: 'success',
        message: 'Session revoked',
      });
      await onSessionsRefresh();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to revoke session',
      });
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    setShowRevokeAllConfirm(true);
  };

  const confirmRevokeAll = async () => {
    setRevoking('all');
    try {
      await api.post('/api/auth/sessions/revoke-all');
      addToast({
        type: 'success',
        message: 'All sessions revoked',
      });
      await onSessionsRefresh();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to revoke sessions',
      });
    } finally {
      setRevoking(null);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = async () => {
    // Validation
    if (!passwordData.currentPassword.trim()) {
      addToast({ type: 'error', message: 'Current password is required' });
      return;
    }
    if (!passwordData.newPassword.trim()) {
      addToast({ type: 'error', message: 'New password is required' });
      return;
    }
    if (passwordData.newPassword.length < 8) {
      addToast({ type: 'error', message: 'Password must be at least 8 characters' });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      addToast({ type: 'error', message: 'Passwords do not match' });
      return;
    }

    setIsResettingPassword(true);
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      addToast({
        type: 'success',
        message: 'Password updated successfully',
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || 'Failed to update password',
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <>
      <ConfirmationModal
        isOpen={showRevokeAllConfirm}
        title="Sign out everywhere?"
        message="This will sign you out of all devices. Your current session will remain active."
        confirmLabel="Sign out all"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={confirmRevokeAll}
        onCancel={() => setShowRevokeAllConfirm(false)}
      />

      <div className="space-y-8">
      {/* Email Section */}
      <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Email Address</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Your account email address</p>
        <div className="flex items-center justify-between">
          <span className="text-gray-900 dark:text-white font-medium">{userEmail || 'Loading...'}</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <span className="w-2 h-2 bg-green-600 dark:bg-green-400 rounded-full"></span>
            Verified
          </span>
        </div>
      </div>

      {/* Password Section */}
      {authProvider !== 'google' ? (
        <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Password</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Manage your password and security</p>

          {!showPasswordForm ? (
            <Button
              variant="secondary"
              onClick={() => setShowPasswordForm(true)}
            >
              Change Password
            </Button>
          ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Current Password
              </label>
              <input
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Enter current password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                New Password
              </label>
              <input
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                placeholder="Enter new password (min 8 chars)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Confirm new password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-white/[0.08] rounded-lg bg-white dark:bg-white/[0.03] text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 pt-3">
              <Button
                variant="primary"
                onClick={handlePasswordSubmit}
                disabled={isResettingPassword}
              >
                {isResettingPassword ? 'Updating...' : 'Update Password'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowPasswordForm(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        </div>
      ) : (
        <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-6 bg-blue-50 dark:bg-blue-900/10">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">Password</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
            You signed up using Google. Your password is managed by Google.
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            🔒 Your account is secure. Google handles your authentication.
          </p>
        </div>
      )}

      {/* Security Section */}
      <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Account Security</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Keep your account secure</p>
        <div className="space-y-3">
          <div className="flex items-start justify-between p-3 bg-gray-50 dark:bg-white/[0.02] rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Two-Factor Authentication</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Add extra security to your account</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              Coming Soon
            </span>
          </div>
          <div className="flex items-start justify-between p-3 bg-gray-50 dark:bg-white/[0.02] rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Login Activity</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">View recent login history and sessions</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              Profile Tab
            </span>
          </div>
        </div>
      </div>

      {/* Active Sessions Section */}
      {sessions && sessions.length > 0 && (
        <div className="border border-gray-200 dark:border-white/[0.06] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            Active Sessions
          </h3>

          <div className="space-y-3 mb-6">
            {sessions.map((session) => {
              const device = getDeviceInfo(session.userAgent || '');
              return (
                <div
                  key={session.id}
                  className="p-4 border border-gray-200 dark:border-white/[0.06] rounded-lg hover:border-gray-300 dark:hover:border-white/[0.1] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{device.icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {device.type}
                            </h4>
                            {session.isCurrent && (
                              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {session.ipAddress && `IP: ${session.ipAddress}`}
                          </p>
                        </div>
                      </div>

                      {/* Session Details */}
                      <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {session.createdAt && (
                          <p>Created: {formatDate(session.createdAt)}</p>
                        )}
                        {session.expiresAt && (
                          <p>Expires: {formatDate(session.expiresAt)}</p>
                        )}
                      </div>
                    </div>

                    {/* Revoke Button */}
                    {!session.isCurrent && (
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        disabled={revoking !== null}
                        className={cn(
                          'ml-4 px-3 py-1 text-sm font-medium',
                          'text-red-600 dark:text-red-400',
                          'hover:bg-red-50 dark:hover:bg-red-900/20',
                          'rounded transition-colors',
                          revoking === session.id && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {revoking === session.id ? 'Revoking...' : 'Revoke'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Revoke All Button */}
          <div className="flex justify-end">
            <button
              onClick={handleRevokeAllSessions}
              disabled={revoking !== null}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                'bg-red-600 text-white hover:bg-red-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {revoking === 'all' ? 'Revoking all...' : 'Revoke all sessions'}
            </button>
          </div>

          {/* Info Box */}
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              <strong>Note:</strong> Revoking a session will sign you out on that device. Your current session will remain active.
            </p>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="border border-red-200 dark:border-red-900/30 rounded-lg p-6 bg-red-50 dark:bg-red-900/10">
        <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">Danger Zone</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">Irreversible actions</p>
        <Button
          variant="secondary"
          className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20"
          disabled
        >
          Delete Account (Coming Soon)
        </Button>
      </div>
      </div>
    </>
  );
};

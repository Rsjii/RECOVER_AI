import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { ConfirmationModal } from '../ui/ConfirmationModal';
import { useNotification } from '../../hooks/useNotification';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { SessionInfo, ProfileFormData } from '../../types/settings';

interface AccountSectionProps {
  userEmail?: string;
  authProvider?: 'email' | 'google' | 'both';
  sessions?: SessionInfo[];
  onSessionsRefresh?: () => Promise<void>;
  profileData?: ProfileFormData;
  onProfileChange?: (field: string, value: any) => void;
  onSave?: () => Promise<void>;
  onCancel?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
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

export const AccountSection: React.FC<AccountSectionProps> = ({
  userEmail,
  authProvider = 'email',
  sessions = [],
  onSessionsRefresh = async () => {},
  profileData = { companyName: '', email: '', timezone: 'UTC', logoUrl: undefined },
  onProfileChange = () => {},
  onSave = async () => {},
  onCancel = () => {},
  isSaving = false,
  isDirty = false,
}) => {
  const navigate = useNavigate();
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

  const handleRestartTour = () => {
    localStorage.removeItem('tour_main_onboarding_started');
    localStorage.removeItem('tour_main_onboarding_completed');
    navigate('/dashboard');
  };

  const handleProfileSave = async () => {
    try {
      await onSave?.();
      addToast({
        type: 'success',
        message: 'Profile updated successfully',
      });
    } catch (err) {
      // Error already shown by hook
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  };

  const getDeviceInfo = (userAgent: string): { browser: string; device: string; icon: string; os: string } => {
    let browser = 'Unknown';
    let device = 'Unknown';
    let os = 'Unknown';
    let icon = '💻';

    // Browser detection
    if (userAgent.includes('Chrome') && !userAgent.includes('Chromium')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
    } else if (userAgent.includes('Edge')) {
      browser = 'Edge';
    }

    // Device detection
    if (userAgent.includes('iPhone')) {
      device = 'iPhone';
      icon = '📱';
    } else if (userAgent.includes('iPad')) {
      device = 'iPad';
      icon = '📱';
    } else if (userAgent.includes('Android')) {
      device = 'Android';
      icon = '📱';
    } else {
      device = 'Desktop';
      icon = '💻';
    }

    // OS detection
    if (userAgent.includes('Windows')) {
      os = 'Windows';
    } else if (userAgent.includes('Mac')) {
      os = 'macOS';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      os = 'iOS';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
    }

    return { browser, device, icon, os };
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await api.delete(`/api/auth/sessions/${sessionId}`);
      addToast({
        type: 'success',
        message: 'Session signed out',
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
        message: 'All sessions revoked. Signing you out...',
      });
      setTimeout(() => navigate('/login'), 1500);
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

  const currentSession = sessions?.find(s => s.isCurrent);
  const otherSessions = sessions?.filter(s => !s.isCurrent) || [];

  return (
    <>
      <ConfirmationModal
        isOpen={showRevokeAllConfirm}
        title="Sign out everywhere?"
        message="You'll be signed out of all devices. You can sign back in on this device anytime."
        confirmLabel="Sign out all"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={confirmRevokeAll}
        onCancel={() => setShowRevokeAllConfirm(false)}
      />

      <div className="space-y-6">
        {/* ===== 1. COMPANY PROFILE FORM ===== */}
        <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Company Profile</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Update your company information</p>

          <div className="space-y-5">
            {/* Company Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={profileData?.companyName || ''}
                onChange={(e) => onProfileChange('companyName', e.target.value)}
                placeholder="Acme Inc"
                maxLength={100}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400',
                  'bg-white dark:bg-white/[0.03]',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all',
                  'border-gray-300 dark:border-white/[0.08]'
                )}
              />
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Timezone
              </label>
              <select
                value={profileData?.timezone || 'UTC'}
                onChange={(e) => onProfileChange('timezone', e.target.value)}
                className={cn(
                  'w-full px-4 py-2.5 border rounded-lg',
                  'text-gray-900 dark:text-white',
                  'bg-white dark:bg-white/[0.03]',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all',
                  'border-gray-300 dark:border-white/[0.08]',
                  '[&_option]:text-gray-900 [&_option]:bg-white',
                  '[&_option:checked]:bg-blue-600 [&_option:checked]:text-white',
                  'dark:[&_option]:text-white dark:[&_option]:bg-gray-800',
                  'dark:[&_option:checked]:bg-blue-600 dark:[&_option:checked]:text-white'
                )}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Used for scheduling emails</p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-200 dark:border-white/[0.06]">
            <button
              onClick={onCancel}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-all',
                'text-gray-700 dark:text-gray-300',
                'hover:bg-gray-100 dark:hover:bg-white/[0.08]',
                !isDirty && 'opacity-50 cursor-not-allowed'
              )}
              disabled={!isDirty || isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleProfileSave}
              disabled={!isDirty || isSaving}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-all',
                'bg-blue-600 text-white hover:bg-blue-700',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* ===== 2. SECURITY & PASSWORD CARD ===== */}
        <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-xl p-6 sm:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Account Security</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage password and device access</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Account Email (Read-only) */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06]">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Account Email</p>
                <p className="text-gray-900 dark:text-white font-medium mt-1">{userEmail || 'Loading...'}</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Verified
              </span>
            </div>

            {/* Password Section */}
            {authProvider !== 'google' ? (
              <div className="border-t border-gray-200 dark:border-white/[0.06] pt-5">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Password</p>

                {!showPasswordForm ? (
                  <Button
                    variant="secondary"
                    onClick={() => setShowPasswordForm(true)}
                    className="w-full sm:w-auto"
                  >
                    Change Password
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <input
                      type="password"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      placeholder="Current password"
                      className={cn(
                        'w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400',
                        'bg-white dark:bg-white/[0.03]',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        'border-gray-300 dark:border-white/[0.08]'
                      )}
                    />
                    <input
                      type="password"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordChange}
                      placeholder="New password (min 8 chars)"
                      className={cn(
                        'w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400',
                        'bg-white dark:bg-white/[0.03]',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        'border-gray-300 dark:border-white/[0.08]'
                      )}
                    />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordChange}
                      placeholder="Confirm new password"
                      className={cn(
                        'w-full px-4 py-2.5 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400',
                        'bg-white dark:bg-white/[0.03]',
                        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                        'border-gray-300 dark:border-white/[0.08]'
                      )}
                    />
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="primary"
                        onClick={handlePasswordSubmit}
                        disabled={isResettingPassword}
                        className="flex-1 sm:flex-none"
                      >
                        {isResettingPassword ? 'Updating...' : 'Update'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        }}
                        className="flex-1 sm:flex-none"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border-t border-gray-200 dark:border-white/[0.06] pt-5 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">🔐 Google Sign-In</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">Your password is managed by Google</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== 3. ACTIVE SESSIONS ===== */}
        {sessions && sessions.length > 0 && (
          <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Active Sessions</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Devices where you're signed in</p>

            <div className="space-y-4">
              {/* Current Session - Highlighted */}
              {currentSession && (
                <>
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current Session</div>
                  <div className={cn(
                    'p-4 border rounded-lg transition-all',
                    'border-blue-300 dark:border-blue-600/40 bg-blue-50 dark:bg-blue-900/20'
                  )}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">
                        {getDeviceInfo(currentSession.userAgent || '').icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {getDeviceInfo(currentSession.userAgent || '').browser}
                          </h3>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {getDeviceInfo(currentSession.userAgent || '').device}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            Active
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                          {currentSession.ipAddress && `IP: ${currentSession.ipAddress}`}
                          {currentSession.createdAt && ` • Signed in ${formatDate(currentSession.createdAt)}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Other Sessions */}
              {otherSessions.length > 0 && (
                <>
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-6">Other Devices</div>
                  <div className="space-y-3">
                    {otherSessions.map((session) => {
                      const deviceInfo = getDeviceInfo(session.userAgent || '');
                      const lastActive = session.lastActive ? new Date(session.lastActive) : new Date(session.createdAt);
                      const isActive = Date.now() - lastActive.getTime() < 3600000;

                      return (
                        <div key={session.id} className="p-4 border border-gray-200 dark:border-white/[0.06] rounded-lg hover:border-gray-300 dark:hover:border-white/[0.1] transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <span className="text-2xl flex-shrink-0">{deviceInfo.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-medium text-gray-900 dark:text-white">
                                    {deviceInfo.browser}
                                  </h3>
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {deviceInfo.device}
                                  </span>
                                  {isActive && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                      Active now
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 truncate">
                                  {deviceInfo.os}
                                  {session.ipAddress && ` • ${session.ipAddress}`}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRevokeSession(session.id)}
                              disabled={revoking !== null}
                              className={cn(
                                'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap flex-shrink-0 transition-colors',
                                'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
                                revoking === session.id && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              {revoking === session.id ? 'Revoking...' : 'Sign out'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Sign Out All */}
              {otherSessions.length > 0 && (
                <div className="flex justify-end mt-6 pt-6 border-t border-gray-200 dark:border-white/[0.06]">
                  <button
                    onClick={handleRevokeAllSessions}
                    disabled={revoking !== null}
                    className={cn(
                      'px-4 py-2 rounded-lg font-medium transition-colors text-white',
                      'bg-red-600 hover:bg-red-700',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {revoking === 'all' ? 'Signing out...' : 'Sign out everywhere'}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 <strong>Tip:</strong> Signing out other devices won't affect this current session.
              </p>
            </div>
          </div>
        )}

        {/* ===== 4. ONBOARDING TOUR (Optional) ===== */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 sm:p-8 hover:border-blue-300 dark:hover:border-blue-700 transition-all">
          <div className="flex items-start gap-4 sm:gap-6">
            <div className="text-3xl flex-shrink-0">🎓</div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">Learn the Basics</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                Take a guided tour of RecoverAI. ~5 minutes, 7 interactive steps.
              </p>
              <button
                onClick={handleRestartTour}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 active:scale-95 transition-all"
              >
                Start Tour
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

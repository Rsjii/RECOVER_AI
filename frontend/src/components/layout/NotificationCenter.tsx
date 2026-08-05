import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';

interface NotificationEvent {
  id: string;
  event_type: string;
  title: string;
  message?: string;
  icon?: string;
  priority: 'critical' | 'warning' | 'info';
  read_at?: string;
  action_url?: string;
  action_label?: string;
  created_at: string;
}

export const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const { company } = useAuth();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch unread notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: NotificationEvent[] }>(
        '/api/notifications/unread'
      );
      setNotifications(response.data || []);
      setUnreadCount(response.data?.length || 0);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    if (company?.id) {
      fetchNotifications();
    }
  }, [company?.id]);

  // Refresh notifications when popover opens
  useEffect(() => {
    if (popoverOpen && company?.id) {
      fetchNotifications();
    }
  }, [popoverOpen, company?.id]);

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    if (popoverOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popoverOpen]);

  // Mark notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await api.post(`/api/notifications/${notificationId}/read`);
      // Remove from list
      setNotifications(notifications.filter(n => n.id !== notificationId));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  // Dismiss notification
  const handleDismiss = async (notificationId: string) => {
    try {
      await api.post(`/api/notifications/${notificationId}/dismiss`);
      setNotifications(notifications.filter(n => n.id !== notificationId));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    }
  };

  // Navigate and mark as read
  const handleNavigate = async (notification: NotificationEvent) => {
    if (notification.action_url) {
      await handleMarkAsRead(notification.id);
      navigate(notification.action_url);
      setPopoverOpen(false);
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-l-4 border-red-500 bg-red-50 dark:bg-red-900/15';
      case 'warning':
        return 'border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/15';
      default:
        return 'border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/15';
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button - Always visible */}
      <button
        onClick={() => setPopoverOpen(!popoverOpen)}
        className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
        title={unreadCount === 0 ? 'No new notifications' : `${unreadCount} notification${unreadCount !== 1 ? 's' : ''}`}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0018 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {/* Unread Badge - Only show if > 0 */}
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 dark:bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Popover */}
      {popoverOpen && (
        <>
          {/* Overlay */}
          <div className="fixed inset-0 z-40" onClick={() => setPopoverOpen(false)} />

          {/* Popover Card */}
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-[#1a1a1c] border border-gray-200 dark:border-white/[0.08] rounded-xl shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 px-4 py-3 border-b border-gray-200 dark:border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.5a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V7z" />
                </svg>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Notifications ({unreadCount})
                </h3>
              </div>
              <button
                onClick={() => setPopoverOpen(false)}
                className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="max-h-96 overflow-y-auto space-y-2 p-3">
              {loading ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">No notifications</div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`p-3 rounded-lg ${getPriorityColor(notification.priority)} hover:shadow-md transition-shadow cursor-pointer group`}
                    onClick={() => handleNavigate(notification)}
                  >
                    <div className="flex items-start gap-3">
                      {notification.icon && <span className="text-lg mt-0.5 flex-shrink-0">{notification.icon}</span>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{notification.title}</p>
                        {notification.message && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{notification.message}</p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                          {new Date(notification.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismiss(notification.id);
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-white/[0.1] rounded transition-colors"
                          title="Dismiss"
                        >
                          <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-white/[0.08] px-4 py-3 bg-gray-50 dark:bg-white/[0.02] flex gap-2">
              <button
                onClick={() => {
                  navigate('/activity');
                  setPopoverOpen(false);
                }}
                className="flex-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline"
              >
                View All Activity →
              </button>
              <button
                onClick={() => {
                  navigate('/settings?tab=notifications');
                  setPopoverOpen(false);
                }}
                className="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
              >
                Preferences →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

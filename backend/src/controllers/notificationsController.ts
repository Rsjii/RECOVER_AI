import { Request, Response } from 'express';
import { logInfo, logError } from '../utils/logger';
import {
  getUnreadNotifications,
  getAllNotifications,
  markNotificationAsRead,
  dismissNotification,
  getUnreadCount,
  getNotificationsByType,
  markAllAsRead,
  createNotificationEvent,
} from '../db/notificationEvents';

const MODULE = 'NotificationsController';

/**
 * Helper to safely parse query params
 */
function getQueryParam(param: any): string {
  if (Array.isArray(param)) return param[0] || '';
  return typeof param === 'string' ? param : '';
}

/**
 * GET /api/notifications/unread
 * Get unread notifications for the authenticated company
 */
export async function getUnreadHandler(req: Request, res: Response): Promise<void> {
  try {
    const companyId = (req as any).companyId;

    if (!companyId) {
      logError(MODULE, 'getUnreadHandler', 'No company ID in request');
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }

    logInfo(MODULE, 'getUnreadHandler', `Getting unread notifications for company ${companyId}`);

    const notifications = await getUnreadNotifications(companyId);

    res.status(200).json({ data: notifications, count: notifications.length });
  } catch (err: any) {
    logError(MODULE, 'getUnreadHandler', 'Error getting unread notifications', err);
    res.status(500).json({ error: 'Failed to get notifications', code: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /api/notifications
 * Get all notifications for the authenticated company (last 30 days)
 */
export async function getAllHandler(req: Request, res: Response): Promise<void> {
  try {
    const companyId = (req as any).companyId;
    const limit = parseInt(getQueryParam(req.query.limit)) || 100;
    const offset = parseInt(getQueryParam(req.query.offset)) || 0;

    if (!companyId) {
      logError(MODULE, 'getAllHandler', 'No company ID in request');
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }

    logInfo(MODULE, 'getAllHandler', `Getting notifications for company ${companyId}`, { limit, offset });

    const notifications = await getAllNotifications(companyId, limit, offset);

    res.status(200).json({ data: notifications, count: notifications.length });
  } catch (err: any) {
    logError(MODULE, 'getAllHandler', 'Error getting notifications', err);
    res.status(500).json({ error: 'Failed to get notifications', code: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
export async function getUnreadCountHandler(req: Request, res: Response): Promise<void> {
  try {
    const companyId = (req as any).companyId;

    if (!companyId) {
      logError(MODULE, 'getUnreadCountHandler', 'No company ID in request');
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }

    const count = await getUnreadCount(companyId);

    res.status(200).json({ data: { count } });
  } catch (err: any) {
    logError(MODULE, 'getUnreadCountHandler', 'Error getting unread count', err);
    res.status(500).json({ error: 'Failed to get count', code: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /api/notifications/:id/read
 * Mark a notification as read
 */
export async function markAsReadHandler(req: Request, res: Response): Promise<void> {
  try {
    const companyId = (req as any).companyId;
    const idParam = getQueryParam(req.params.id || '');

    if (!companyId) {
      logError(MODULE, 'markAsReadHandler', 'No company ID in request');
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }

    if (!idParam) {
      logError(MODULE, 'markAsReadHandler', 'No notification ID provided');
      res.status(400).json({ error: 'Notification ID required', code: 'INVALID_INPUT' });
      return;
    }

    logInfo(MODULE, 'markAsReadHandler', `Marking notification ${idParam} as read for company ${companyId}`);

    const notification = await markNotificationAsRead(idParam, companyId);

    res.status(200).json({ data: notification });
  } catch (err: any) {
    logError(MODULE, 'markAsReadHandler', 'Error marking notification as read', err);
    res.status(500).json({ error: 'Failed to mark as read', code: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /api/notifications/:id/dismiss
 * Dismiss a notification
 */
export async function dismissHandler(req: Request, res: Response): Promise<void> {
  try {
    const companyId = (req as any).companyId;
    const idParam = getQueryParam(req.params.id || '');

    if (!companyId) {
      logError(MODULE, 'dismissHandler', 'No company ID in request');
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }

    if (!idParam) {
      logError(MODULE, 'dismissHandler', 'No notification ID provided');
      res.status(400).json({ error: 'Notification ID required', code: 'INVALID_INPUT' });
      return;
    }

    logInfo(MODULE, 'dismissHandler', `Dismissing notification ${idParam} for company ${companyId}`);

    await dismissNotification(idParam, companyId);

    res.status(200).json({ data: { success: true } });
  } catch (err: any) {
    logError(MODULE, 'dismissHandler', 'Error dismissing notification', err);
    res.status(500).json({ error: 'Failed to dismiss', code: 'INTERNAL_ERROR' });
  }
}

/**
 * GET /api/notifications/by-type/:eventType
 * Get notifications filtered by type
 */
export async function getByTypeHandler(req: Request, res: Response): Promise<void> {
  try {
    const companyId = (req as any).companyId;
    const eventTypeParam = getQueryParam(req.params.eventType || '');
    const limit = parseInt(getQueryParam(req.query.limit)) || 50;

    if (!companyId) {
      logError(MODULE, 'getByTypeHandler', 'No company ID in request');
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }

    if (!eventTypeParam) {
      logError(MODULE, 'getByTypeHandler', 'No event type provided');
      res.status(400).json({ error: 'Event type required', code: 'INVALID_INPUT' });
      return;
    }

    logInfo(MODULE, 'getByTypeHandler', `Getting notifications by type: ${eventTypeParam} for company ${companyId}`);

    const notifications = await getNotificationsByType(companyId, eventTypeParam, limit);

    res.status(200).json({ data: notifications, count: notifications.length });
  } catch (err: any) {
    logError(MODULE, 'getByTypeHandler', 'Error getting notifications by type', err);
    res.status(500).json({ error: 'Failed to get notifications', code: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for the company
 */
export async function markAllReadHandler(req: Request, res: Response): Promise<void> {
  try {
    const companyId = (req as any).companyId;

    if (!companyId) {
      logError(MODULE, 'markAllReadHandler', 'No company ID in request');
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }

    logInfo(MODULE, 'markAllReadHandler', `Marking all notifications as read for company ${companyId}`);

    const count = await markAllAsRead(companyId);

    res.status(200).json({ data: { success: true, marked_count: count } });
  } catch (err: any) {
    logError(MODULE, 'markAllReadHandler', 'Error marking all as read', err);
    res.status(500).json({ error: 'Failed to mark all as read', code: 'INTERNAL_ERROR' });
  }
}

/**
 * POST /api/notifications/test
 * Send a test notification for verifying notification system
 */
export async function sendTestNotificationHandler(req: Request, res: Response): Promise<void> {
  try {
    const companyId = (req as any).companyId;

    if (!companyId) {
      logError(MODULE, 'sendTestNotificationHandler', 'No company ID in request');
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }

    logInfo(MODULE, 'sendTestNotificationHandler', `Sending test notification for company ${companyId}`);

    await createNotificationEvent(
      companyId,
      'test_notification',
      '✅ Test notification working',
      {
        message: 'This is a test notification to verify your notification system is working correctly.',
        icon: '✅',
        priority: 'info',
        action_url: '/dashboard',
        action_label: 'Back to Dashboard',
        metadata: { event_type: 'test', timestamp: new Date().toISOString() },
      }
    );

    res.status(200).json({ data: { success: true, message: 'Test notification sent' } });
  } catch (err: any) {
    logError(MODULE, 'sendTestNotificationHandler', 'Error sending test notification', err);
    res.status(500).json({ error: 'Failed to send test notification', code: 'INTERNAL_ERROR' });
  }
}

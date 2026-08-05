import { pool } from '../config/database';

export interface NotificationEvent {
  id: string;
  company_id: string;
  event_type: string;
  title: string;
  message?: string;
  icon?: string;
  priority: 'critical' | 'warning' | 'info';
  read_at?: string;
  action_url?: string;
  action_label?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * Create a new notification event
 */
export async function createNotificationEvent(
  companyId: string,
  eventType: string,
  title: string,
  options?: {
    message?: string;
    icon?: string;
    priority?: 'critical' | 'warning' | 'info';
    action_url?: string;
    action_label?: string;
    metadata?: Record<string, any>;
  }
): Promise<NotificationEvent> {
  try {
    const result = await pool.query<NotificationEvent>(
      `INSERT INTO notification_events (
        company_id,
        event_type,
        title,
        message,
        icon,
        priority,
        action_url,
        action_label,
        metadata,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        companyId,
        eventType,
        title,
        options?.message || null,
        options?.icon || null,
        options?.priority || 'info',
        options?.action_url || null,
        options?.action_label || null,
        options?.metadata ? JSON.stringify(options.metadata) : null,
      ]
    );

    return result.rows[0];
  } catch (err) {
    console.error('Error creating notification event:', err);
    throw err;
  }
}

/**
 * Get unread notifications for a company (last 7 days)
 */
export async function getUnreadNotifications(companyId: string): Promise<NotificationEvent[]> {
  try {
    const result = await pool.query<NotificationEvent>(
      `SELECT * FROM notification_events
       WHERE company_id = $1 AND read_at IS NULL
       ORDER BY created_at DESC
       LIMIT 100`,
      [companyId]
    );

    return result.rows;
  } catch (err) {
    console.error('Error getting unread notifications:', err);
    throw err;
  }
}

/**
 * Get all notifications for a company (last 30 days)
 * Used for activity-like view
 */
export async function getAllNotifications(
  companyId: string,
  limit: number = 100,
  offset: number = 0
): Promise<NotificationEvent[]> {
  try {
    const result = await pool.query<NotificationEvent>(
      `SELECT * FROM notification_events
       WHERE company_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [companyId, limit, offset]
    );

    return result.rows;
  } catch (err) {
    console.error('Error getting all notifications:', err);
    throw err;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string, companyId: string): Promise<NotificationEvent> {
  try {
    const result = await pool.query<NotificationEvent>(
      `UPDATE notification_events
       SET read_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [notificationId, companyId]
    );

    if (result.rows.length === 0) {
      throw new Error('Notification not found');
    }

    return result.rows[0];
  } catch (err) {
    console.error('Error marking notification as read:', err);
    throw err;
  }
}

/**
 * Dismiss/delete a notification (soft delete)
 */
export async function dismissNotification(notificationId: string, companyId: string): Promise<void> {
  try {
    // Soft delete by setting read_at far in the past (effectively hiding it)
    // Alternatively, we could hard delete: DELETE FROM notification_events WHERE id = $1
    // For now, soft delete to keep audit trail
    await pool.query(
      `UPDATE notification_events
       SET read_at = NOW()
       WHERE id = $1 AND company_id = $2`,
      [notificationId, companyId]
    );
  } catch (err) {
    console.error('Error dismissing notification:', err);
    throw err;
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(companyId: string): Promise<number> {
  try {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notification_events
       WHERE company_id = $1 AND read_at IS NULL`,
      [companyId]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (err) {
    console.error('Error getting unread count:', err);
    throw err;
  }
}

/**
 * Check if unread system alert already exists for this event type
 * Only checks UNREAD alerts to allow recreation after dismissal
 * NO time window - once dismissed, new one can be created immediately
 */
export async function hasRecentUnreadSystemAlert(
  companyId: string,
  eventTypeInMetadata: string
): Promise<boolean> {
  try {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notification_events
       WHERE company_id = $1
       AND event_type = 'system_alert'
       AND read_at IS NULL
       AND metadata->>'event_type' = $2`,
      [companyId, eventTypeInMetadata]
    );

    return parseInt(result.rows[0]?.count || '0', 10) > 0;
  } catch (err) {
    console.error('Error checking for system alert:', err);
    return false;
  }
}

/**
 * Get notifications by type
 */
export async function getNotificationsByType(
  companyId: string,
  eventType: string,
  limit: number = 50
): Promise<NotificationEvent[]> {
  try {
    const result = await pool.query<NotificationEvent>(
      `SELECT * FROM notification_events
       WHERE company_id = $1 AND event_type = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [companyId, eventType, limit]
    );

    return result.rows;
  } catch (err) {
    console.error('Error getting notifications by type:', err);
    throw err;
  }
}

/**
 * Mark all notifications as read for a company
 */
export async function markAllAsRead(companyId: string): Promise<number> {
  try {
    const result = await pool.query<{ count: string }>(
      `UPDATE notification_events
       SET read_at = NOW()
       WHERE company_id = $1 AND read_at IS NULL
       RETURNING COUNT(*) as count`,
      [companyId]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (err) {
    console.error('Error marking all as read:', err);
    throw err;
  }
}

/**
 * Clear old notifications (cleanup)
 * Delete read notifications older than 30 days AND unread ones older than 90 days
 */
export async function clearOldNotifications(companyId: string): Promise<number> {
  try {
    const result = await pool.query<{ count: string }>(
      `DELETE FROM notification_events
       WHERE company_id = $1 AND (
         (read_at IS NOT NULL AND created_at < NOW() - INTERVAL '30 days') OR
         (read_at IS NULL AND created_at < NOW() - INTERVAL '90 days')
       )
       RETURNING COUNT(*) as count`,
      [companyId]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (err) {
    console.error('Error clearing old notifications:', err);
    throw err;
  }
}

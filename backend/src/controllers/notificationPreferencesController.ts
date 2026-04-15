import { Request, Response } from 'express';
import { logInfo, logError } from '../utils/logger';
import {
  getNotificationPreferences,
  upsertNotificationPreferences,
  NotificationPreferences,
} from '../db/notificationPreferences';

const MODULE = 'NotificationPreferencesController';

/**
 * GET /api/settings/notifications
 * Get notification preferences for the authenticated company
 */
export async function getNotificationPreferencesHandler(req: Request, res: Response): Promise<void> {
  try {
    const companyId = (req as any).companyId;

    if (!companyId) {
      logError(MODULE, 'getNotificationPreferencesHandler', 'No company ID in request');
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }

    logInfo(MODULE, 'getNotificationPreferencesHandler', `Getting preferences for company ${companyId}`);

    const prefs = await getNotificationPreferences(companyId);

    res.status(200).json({ data: prefs });
  } catch (err: any) {
    logError(MODULE, 'getNotificationPreferencesHandler', 'Error getting preferences', err);
    res.status(500).json({ error: 'Failed to get preferences', code: 'INTERNAL_ERROR' });
  }
}

/**
 * PATCH /api/settings/notifications
 * Update notification preferences for the authenticated company
 */
export async function updateNotificationPreferencesHandler(req: Request, res: Response): Promise<void> {
  try {
    const companyId = (req as any).companyId;
    const updates = req.body;

    if (!companyId) {
      logError(MODULE, 'updateNotificationPreferencesHandler', 'No company ID in request');
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }

    // Validate update payload
    const validFields = [
      'system_alerts',
      'daily_actions',
      'daily_actions_email',
      'daily_actions_time',
      'agent_activity',
      'agent_activity_email',
      'payment_received',
      'payment_received_email',
      'weekly_digest',
      'weekly_digest_day',
      'weekly_digest_time',
      'monthly_report',
      'quiet_hours_enabled',
      'quiet_hours_start',
      'quiet_hours_end',
    ];

    const invalidFields = Object.keys(updates).filter(k => !validFields.includes(k));
    if (invalidFields.length > 0) {
      logError(MODULE, 'updateNotificationPreferencesHandler', `Invalid fields: ${invalidFields.join(', ')}`);
      res.status(400).json({ error: `Invalid fields: ${invalidFields.join(', ')}`, code: 'INVALID_INPUT' });
      return;
    }

    logInfo(MODULE, 'updateNotificationPreferencesHandler', `Updating preferences for company ${companyId}`, updates);

    const updatedPrefs = await upsertNotificationPreferences(companyId, updates);

    res.status(200).json({ data: updatedPrefs });
  } catch (err: any) {
    logError(MODULE, 'updateNotificationPreferencesHandler', 'Error updating preferences', err);
    res.status(500).json({ error: 'Failed to update preferences', code: 'INTERNAL_ERROR' });
  }
}

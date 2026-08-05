import { Request, Response } from 'express';
import { findCompanyById, updateCompany } from '../db/companies';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'notificationPreferencesController';

/**
 * GET /api/settings/notifications
 * Get user-customizable notification preferences
 * Note: System alerts and trial ending are ALWAYS ON (not customizable)
 */
export const getNotificationPreferencesHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getNotificationPreferences';
  const companyId = (req as any).companyId;

  try {
    const company = await findCompanyById(companyId);
    if (!company) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    res.status(200).json({
      data: {
        notify_contact_invalid: (company as any).notify_contact_invalid ?? true,
        notify_payment_received: (company as any).notify_payment_received ?? true,
        notify_emails_pending: (company as any).notify_emails_pending ?? true,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get notification preferences', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PATCH /api/settings/notifications
 * Update user-customizable notification preferences
 */
export const updateNotificationPreferencesHandler = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateNotificationPreferences';
  const companyId = (req as any).companyId;

  try {
    const {
      notify_contact_invalid,
      notify_payment_received,
      notify_emails_pending,
    } = req.body;

    const updates: any = {};

    if (notify_contact_invalid !== undefined) updates.notify_contact_invalid = Boolean(notify_contact_invalid);
    if (notify_payment_received !== undefined) updates.notify_payment_received = Boolean(notify_payment_received);
    if (notify_emails_pending !== undefined) updates.notify_emails_pending = Boolean(notify_emails_pending);

    if (Object.keys(updates).length === 0) {
      sendErrorResponse(res, 400, 'No valid preferences to update');
      return;
    }

    const updated = await updateCompany(companyId, updates);

    logInfo(LOG_MODULE, handler, 'Notification preferences updated', { companyId, updates });

    res.status(200).json({
      data: {
        notify_contact_invalid: (updated as any).notify_contact_invalid ?? true,
        notify_payment_received: (updated as any).notify_payment_received ?? true,
        notify_emails_pending: (updated as any).notify_emails_pending ?? true,
        message: 'Notification preferences updated successfully',
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update notification preferences', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

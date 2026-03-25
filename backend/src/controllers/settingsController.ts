import { Request, Response } from 'express';
import { findCompanyById, updateCompany } from '../db/companies';
import { encryptField, decryptField } from '../lib/encryption';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'settingsController';

/**
 * GET /api/settings
 * Returns company settings (dunning strategy, timezone, slack configured, integrations status)
 */
export const getSettings = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getSettings';
  const companyId = (req as any).companyId;

  try {
    const company = await findCompanyById(companyId);
    if (!company) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    res.status(200).json({
      data: {
        companyId: company.id,
        companyName: company.name,
        timezone: company.timezone,
        preferredCurrency: company.preferred_currency,
        dunningStrategy: company.dunning_strategy,
        pilotMode: (company as any).pilot_mode || 'auto',  // P0
        replyToEmail: (company as any).reply_to_email || null,  // P0
        integrations: {
          stripe: !!company.stripe_api_key_encrypted,
          stripeLastSyncedAt: (company as any).stripe_last_synced_at || null,
          slack: !!company.slack_webhook_url_encrypted,
          quickbooks: !!(company.quickbooks_realm_id && (company as any).quickbooks_access_token_encrypted),
          chargebee: !!(company.chargebee_site && (company as any).chargebee_api_key_encrypted),
          twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
        },
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get settings', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PUT /api/settings/dunning
 * Update dunning strategy: num_emails, days_between, approval_required
 */
export const updateDunningSettings = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateDunningSettings';
  const companyId = (req as any).companyId;

  try {
    const { num_emails, days_between, approval_required } = req.body;

    const updates: any = {};

    if (num_emails !== undefined) {
      const n = parseInt(num_emails);
      if (isNaN(n) || n < 1 || n > 10) {
        sendErrorResponse(res, 400, 'num_emails must be between 1 and 10');
        return;
      }
      updates.num_emails = n;
    }

    if (days_between !== undefined) {
      const d = parseInt(days_between);
      if (isNaN(d) || d < 1 || d > 90) {
        sendErrorResponse(res, 400, 'days_between must be between 1 and 90');
        return;
      }
      updates.days_between = d;
    }

    if (approval_required !== undefined) {
      updates.approval_required = Boolean(approval_required);
    }

    if (Object.keys(updates).length === 0) {
      sendErrorResponse(res, 400, 'No valid fields provided');
      return;
    }

    const company = await findCompanyById(companyId);
    const currentStrategy = company?.dunning_strategy || {};
    const newStrategy = { ...currentStrategy, ...updates };

    await updateCompany(companyId, { dunning_strategy: JSON.stringify(newStrategy) });

    logInfo(LOG_MODULE, handler, 'Dunning settings updated', { companyId, updates });

    res.status(200).json({ data: { dunningStrategy: newStrategy } });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update dunning settings', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PUT /api/settings/slack
 * Save Slack webhook URL (encrypted)
 */
export const updateSlackSettings = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateSlackSettings';
  const companyId = (req as any).companyId;

  try {
    const { webhookUrl } = req.body;

    if (!webhookUrl) {
      sendErrorResponse(res, 400, 'webhookUrl is required');
      return;
    }

    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      sendErrorResponse(res, 400, 'Invalid Slack webhook URL');
      return;
    }

    const encrypted = encryptField(webhookUrl);
    await updateCompany(companyId, { slack_webhook_url_encrypted: encrypted });

    logInfo(LOG_MODULE, handler, 'Slack webhook saved', { companyId });

    res.status(200).json({ message: 'Slack webhook URL saved' });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update Slack settings', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PUT /api/settings/general
 * Update timezone, preferred currency
 */
export const updateGeneralSettings = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateGeneralSettings';
  const companyId = (req as any).companyId;

  try {
    const { timezone, preferredCurrency } = req.body;
    const updates: Record<string, string> = {};

    if (timezone) updates.timezone = timezone;
    if (preferredCurrency) updates.preferred_currency = preferredCurrency.toUpperCase();

    if (Object.keys(updates).length === 0) {
      sendErrorResponse(res, 400, 'No valid fields provided');
      return;
    }

    const company = await updateCompany(companyId, updates);

    logInfo(LOG_MODULE, handler, 'General settings updated', { companyId, updates });

    res.status(200).json({
      data: {
        timezone: company.timezone,
        preferredCurrency: company.preferred_currency,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update general settings', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PATCH /api/settings/pilot-mode (P0)
 * Update pilot mode: 'shadow' | 'auto' | 'paused'
 * Used by Dashboard kill switch and Settings pilot toggle
 */
export const updatePilotMode = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updatePilotMode';
  const companyId = (req as any).companyId;

  try {
    const { mode } = req.body;

    if (!['shadow', 'auto', 'paused'].includes(mode)) {
      sendErrorResponse(res, 400, 'mode must be shadow | auto | paused');
      return;
    }

    const company = await updateCompany(companyId, { pilot_mode: mode });

    logInfo(LOG_MODULE, handler, 'Pilot mode updated', { companyId, mode });

    res.status(200).json({
      data: {
        pilot_mode: company.pilot_mode || mode,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update pilot mode', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

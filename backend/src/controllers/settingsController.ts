import { Request, Response } from 'express';
import { findCompanyById, updateCompany } from '../db/companies';
import { encryptField, decryptField } from '../lib/encryption';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';
import { pool } from '../config/database';

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
        pilotMode: (company as any).pilot_mode || 'auto',
        replyToEmail: (company as any).reply_to_email || null,
        manualMode: company.manual_mode ?? false,
        accountType: (company as any).account_type || 'paid',
        trialStatus: (company as any).trial_status || 'not_started',
        trialEndsAt: (company as any).trial_ends_at || null,
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

/**
 * PATCH /api/settings/manual-mode
 * Toggle manual mode: when ON, all emails queued for approval before sending
 */
export const updateManualMode = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateManualMode';
  const companyId = (req as any).companyId;

  try {
    const { manual_mode } = req.body;

    if (manual_mode === undefined || typeof manual_mode !== 'boolean') {
      sendErrorResponse(res, 400, 'manual_mode must be a boolean');
      return;
    }

    const company = await updateCompany(companyId, { manual_mode });

    logInfo(LOG_MODULE, handler, 'Manual mode updated', { companyId, manual_mode });

    res.status(200).json({
      data: {
        manual_mode: company.manual_mode ?? manual_mode,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update manual mode', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/settings/costs
 * Returns API usage costs (Resend emails + Redis commands)
 */
export const getApiCosts = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getApiCosts';
  const companyId = (req as any).companyId;

  try {
    // Count emails sent this month via email_logs table
    const emailResult = await pool.query(
      `SELECT COUNT(*) as email_count
       FROM email_logs
       WHERE company_id = $1
       AND sent_at > NOW() - INTERVAL '30 days'`,
      [companyId]
    );
    const emailsSent = parseInt(emailResult.rows[0]?.email_count || 0);

    // Resend pricing: $0.25 per 1000 emails (approximately $0.00025 per email)
    const resendCost = (emailsSent * 0.00025).toFixed(2);

    // Redis usage estimation from API logs (non-critical, can be 0)
    // Note: api_logs table doesn't exist yet, so gracefully default to 0
    let redisCommands = 0;
    try {
      const redisResult = await pool.query(
        `SELECT COUNT(*) as command_count
         FROM api_logs
         WHERE company_id = $1
         AND created_at > NOW() - INTERVAL '30 days'`,
        [companyId]
      );
      redisCommands = parseInt(redisResult.rows[0]?.command_count || 0);
    } catch (err) {
      // api_logs table doesn't exist yet - non-blocking, just use 0
      logError(LOG_MODULE, handler, 'api_logs table not found (non-critical)', err);
    }

    // Redis pricing: free up to 500K commands/month, then $0.20 per 100K commands
    let redisCost = '0.00';
    if (redisCommands > 500000) {
      redisCost = (((redisCommands - 500000) * 0.20) / 100000).toFixed(2);
    }

    const totalCost = (parseFloat(resendCost) + parseFloat(redisCost)).toFixed(2);

    logInfo(LOG_MODULE, handler, 'Costs calculated', {
      emailsSent: emailsSent.toString(),
      redisCommands: redisCommands.toString(),
      resendCost,
      redisCost,
      totalCost
    });

    res.status(200).json({
      data: {
        resend: {
          emails_sent: emailsSent,
          cost: parseFloat(resendCost),
        },
        redis: {
          commands: redisCommands,
          cost: parseFloat(redisCost),
        },
        total_cost: parseFloat(totalCost),
      },
    });
  } catch (err: any) {
    logError(LOG_MODULE, handler, 'Failed to get costs', err);
    // Return defaults on error (non-blocking)
    res.status(200).json({
      data: {
        resend: { emails_sent: 0, cost: 0 },
        redis: { commands: 0, cost: 0 },
        total_cost: 0,
        note: 'Unable to fetch real costs',
      },
    });
  }
};

/**
 * PUT /api/settings/dunning-tone
 * Set dunning tone: 'gentle' | 'standard' | 'aggressive'
 */
export const updateDunningTone = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateDunningTone';
  const companyId = (req as any).companyId;

  try {
    const { tone } = req.body;

    if (!['gentle', 'standard', 'aggressive'].includes(tone)) {
      sendErrorResponse(res, 400, 'tone must be gentle, standard, or aggressive');
      return;
    }

    const updated = await updateCompany(companyId, { dunning_tone: tone });

    logInfo(LOG_MODULE, handler, 'Dunning tone updated', { companyId, tone });

    res.status(200).json({
      data: {
        dunning_tone: updated.dunning_tone,
        message: `Dunning tone set to ${tone}`,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update dunning tone', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PUT /api/settings/pause-dunning
 * Pause all dunning until date (or resume if date is null/past)
 */
export const updatePauseDunning = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updatePauseDunning';
  const companyId = (req as any).companyId;

  try {
    const { pauseUntil } = req.body;

    if (pauseUntil) {
      const pauseDate = new Date(pauseUntil);
      if (isNaN(pauseDate.getTime())) {
        sendErrorResponse(res, 400, 'pauseUntil must be a valid date');
        return;
      }
    }

    const updated = await updateCompany(companyId, {
      pause_dunning_until: pauseUntil || null,
    });

    logInfo(LOG_MODULE, handler, 'Pause dunning updated', {
      companyId,
      pauseUntil: updated.pause_dunning_until,
    });

    res.status(200).json({
      data: {
        pause_dunning_until: updated.pause_dunning_until,
        message: pauseUntil
          ? `Dunning paused until ${new Date(pauseUntil).toISOString().split('T')[0]}`
          : 'Dunning resumed',
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update pause dunning', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PUT /api/settings/pause-customer
 * Add or remove customer from pause list
 */
export const updatePauseCustomer = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updatePauseCustomer';
  const companyId = (req as any).companyId;

  try {
    const { customerId, action } = req.body; // action: 'add' | 'remove'

    if (!['add', 'remove'].includes(action)) {
      sendErrorResponse(res, 400, 'action must be add or remove');
      return;
    }

    // Fetch current paused customers
    const company = await findCompanyById(companyId);
    if (!company) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    let pausedCustomers = (company as any).paused_customers || [];

    if (action === 'add' && !pausedCustomers.includes(customerId)) {
      pausedCustomers = [...pausedCustomers, customerId];
    } else if (action === 'remove') {
      pausedCustomers = pausedCustomers.filter((id: string) => id !== customerId);
    }

    const updated = await updateCompany(companyId, {
      paused_customers: pausedCustomers,
    });

    logInfo(LOG_MODULE, handler, 'Paused customer updated', {
      companyId,
      customerId,
      action,
      count: (updated as any).paused_customers?.length || 0,
    });

    res.status(200).json({
      data: {
        paused_customers: (updated as any).paused_customers || [],
        message: action === 'add'
          ? `Customer paused from dunning`
          : `Customer resumed for dunning`,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update pause customer', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PUT /api/settings/aggressive-mode
 * Enable or disable aggressive dunning mode
 */
export const updateAggressiveMode = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateAggressiveMode';
  const companyId = (req as any).companyId;

  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      sendErrorResponse(res, 400, 'enabled must be a boolean');
      return;
    }

    const updated = await updateCompany(companyId, {
      aggressive_enabled: enabled,
    });

    logInfo(LOG_MODULE, handler, 'Aggressive mode updated', {
      companyId,
      enabled: (updated as any).aggressive_enabled,
    });

    res.status(200).json({
      data: {
        aggressive_enabled: (updated as any).aggressive_enabled,
        message: enabled
          ? 'Aggressive mode enabled (Tier 3+ for all invoices)'
          : 'Aggressive mode disabled',
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update aggressive mode', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/settings/dunning-sender-name
 * Fetch the dunning sender name
 */
export const getDunningSenderName = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getDunningSenderName';
  const companyId = (req as any).companyId;

  try {
    const company = await findCompanyById(companyId);
    if (!company) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    res.status(200).json({
      data: {
        senderName: (company as any).dunning_sender_name || '',
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get dunning sender name', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PUT /api/settings/dunning-sender-name
 * Set the name that appears in dunning emails (e.g., "Acme Corp Finance Team")
 */
export const updateDunningSenderName = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateDunningSenderName';
  const companyId = (req as any).companyId;

  try {
    const { senderName } = req.body;

    if (!senderName || typeof senderName !== 'string' || senderName.trim().length < 2) {
      sendErrorResponse(res, 400, 'senderName required (minimum 2 characters)');
      return;
    }

    const updated = await updateCompany(companyId, {
      dunning_sender_name: senderName.trim(),
    });

    logInfo(LOG_MODULE, handler, 'Dunning sender name updated', {
      companyId,
      senderName: senderName.trim(),
    });

    res.status(200).json({
      data: {
        dunning_sender_name: updated.dunning_sender_name,
        message: `Dunning emails will now be signed by: ${senderName.trim()}`,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update dunning sender name', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

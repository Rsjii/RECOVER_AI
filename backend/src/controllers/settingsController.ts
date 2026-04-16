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
        smtpFallbackToResend: (company as any).smtp_fallback_to_resend || false,
        dunningTone: (company as any).dunning_tone || 'standard',
        pauseDunningUntil: (company as any).pause_dunning_until || null,
        pausedCustomers: (company as any).paused_customers || [],
        aggressiveEnabled: (company as any).aggressive_enabled || false,
        accountType: (company as any).account_type || 'paid',
        trialStatus: (company as any).trial_status || 'not_started',
        trialEndsAt: (company as any).trial_ends_at || null,
        integrations: {
          stripe: !!company.stripe_api_key_encrypted,
          stripeLastSyncedAt: (company as any).stripe_last_synced_at || null,
          stripeHasWebhookSecret: !!company.stripe_webhook_secret_encrypted,
          slack: !!company.slack_webhook_url_encrypted,
          quickbooks: !!(company.quickbooks_realm_id && (company as any).quickbooks_access_token_encrypted),
          chargebee: !!(company.chargebee_site && (company as any).chargebee_api_key_encrypted),
          twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER),
          csv: await (async () => {
            try {
              const r = await pool.query(
                `SELECT COUNT(*) AS cnt FROM invoices WHERE company_id = $1 AND source = 'manual'`,
                [companyId]
              );
              return parseInt(r.rows[0]?.cnt || '0') > 0;
            } catch { return false; }
          })(),
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
    const { timezone, preferredCurrency, reply_to_email } = req.body;
    const updates: Record<string, string> = {};

    if (timezone) updates.timezone = timezone;
    if (preferredCurrency) updates.preferred_currency = preferredCurrency.toUpperCase();
    if (reply_to_email !== undefined) updates.reply_to_email = reply_to_email || null;

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
        replyToEmail: (company as any).reply_to_email || null,
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
    const { pilot_mode } = req.body;

    if (!['shadow', 'auto', 'paused'].includes(pilot_mode)) {
      sendErrorResponse(res, 400, 'pilot_mode must be shadow | auto | paused');
      return;
    }

    const company = await updateCompany(companyId, { pilot_mode });

    logInfo(LOG_MODULE, handler, 'Pilot mode updated', { companyId, pilot_mode });

    res.status(200).json({
      data: {
        pilot_mode: company.pilot_mode || pilot_mode,
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
    const { dunning_tone } = req.body;

    if (!['gentle', 'standard', 'aggressive'].includes(dunning_tone)) {
      sendErrorResponse(res, 400, 'dunning_tone must be gentle, standard, or aggressive');
      return;
    }

    const updated = await updateCompany(companyId, { dunning_tone });

    logInfo(LOG_MODULE, handler, 'Dunning tone updated', { companyId, dunning_tone });

    res.status(200).json({
      data: {
        dunning_tone: updated.dunning_tone,
        message: `Dunning tone set to ${dunning_tone}`,
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
    const { pause_dunning_until } = req.body;

    if (pause_dunning_until) {
      const pauseDate = new Date(pause_dunning_until);
      if (isNaN(pauseDate.getTime())) {
        sendErrorResponse(res, 400, 'pause_dunning_until must be a valid date');
        return;
      }
    }

    const updated = await updateCompany(companyId, {
      pause_dunning_until: pause_dunning_until || null,
    });

    logInfo(LOG_MODULE, handler, 'Pause dunning updated', {
      companyId,
      pause_dunning_until: updated.pause_dunning_until,
    });

    res.status(200).json({
      data: {
        pause_dunning_until: updated.pause_dunning_until,
        message: pause_dunning_until
          ? `Dunning paused until ${new Date(pause_dunning_until).toISOString().split('T')[0]}`
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
    const { paused_customers } = req.body;

    if (!Array.isArray(paused_customers)) {
      sendErrorResponse(res, 400, 'paused_customers must be an array of email addresses');
      return;
    }

    const updated = await updateCompany(companyId, {
      paused_customers,
    });

    logInfo(LOG_MODULE, handler, 'Paused customers updated', {
      companyId,
      count: (updated as any).paused_customers?.length || 0,
    });

    res.status(200).json({
      data: {
        paused_customers: (updated as any).paused_customers || [],
        message: paused_customers.length > 0
          ? `${paused_customers.length} customer(s) paused from dunning`
          : `All customers resumed for dunning`,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update paused customers', error);
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
    const { aggressive_enabled } = req.body;

    if (typeof aggressive_enabled !== 'boolean') {
      sendErrorResponse(res, 400, 'aggressive_enabled must be a boolean');
      return;
    }

    const updated = await updateCompany(companyId, {
      aggressive_enabled,
    });

    logInfo(LOG_MODULE, handler, 'Aggressive mode updated', {
      companyId,
      aggressive_enabled: (updated as any).aggressive_enabled,
    });

    res.status(200).json({
      data: {
        aggressive_enabled: (updated as any).aggressive_enabled,
        message: aggressive_enabled
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
 * PUT /api/settings/smtp-fallback
 * Allow or disallow Resend as fallback if SMTP fails
 */
export const updateSmtpFallback = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateSmtpFallback';
  const companyId = (req as any).companyId;

  try {
    const { smtp_fallback_to_resend } = req.body;

    if (typeof smtp_fallback_to_resend !== 'boolean') {
      sendErrorResponse(res, 400, 'smtp_fallback_to_resend must be a boolean');
      return;
    }

    const updated = await updateCompany(companyId, {
      smtp_fallback_to_resend,
    });

    logInfo(LOG_MODULE, handler, 'SMTP fallback setting updated', {
      companyId,
      enabled: (updated as any).smtp_fallback_to_resend,
    });

    res.status(200).json({
      data: {
        smtp_fallback_to_resend: (updated as any).smtp_fallback_to_resend,
        message: smtp_fallback_to_resend
          ? 'SMTP fallback enabled (Resend will be used if SMTP fails)'
          : 'SMTP fallback disabled (SMTP failures will cause hard errors)',
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update SMTP fallback setting', error);
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

/**
 * POST /api/settings/integrations/stripe/disconnect
 * Disconnects Stripe integration (clears API key and webhook secret)
 */
export const disconnectStripe = async (req: Request, res: Response): Promise<void> => {
  const handler = 'disconnectStripe';
  const companyId = (req as any).companyId;

  try {
    const updated = await updateCompany(companyId, {
      stripe_api_key_encrypted: null,
      stripe_account_id: null,
      stripe_webhook_secret_encrypted: null,
      stripe_last_synced_at: null,
    });

    logInfo(LOG_MODULE, handler, 'Stripe disconnected', {
      companyId,
    });

    res.status(200).json({
      data: {
        message: 'Stripe integration disconnected successfully',
        integrations: {
          stripe: false,
        },
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to disconnect Stripe', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/settings/email-mode
 * Get current email mode (shadow|auto) and pending email count
 */
export const getEmailMode = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getEmailMode';
  const companyId = (req as any).companyId;

  try {
    const company = await findCompanyById(companyId);
    if (!company) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    // Count pending emails
    const pendingResult = await pool.query(
      `SELECT COUNT(*) as count FROM pilot_queued_emails
       WHERE company_id = $1 AND status = 'pending'`,
      [companyId]
    );

    const pendingCount = parseInt(pendingResult.rows[0]?.count || '0');

    logInfo(LOG_MODULE, handler, 'Email mode retrieved', {
      companyId,
      mode: company.pilot_mode || 'shadow',
      pendingCount,
    });

    res.status(200).json({
      data: {
        mode: company.pilot_mode || 'shadow',
        pendingCount,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get email mode', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/settings/email-mode
 * Switch email mode (shadow↔auto) with pending email action
 * pendingAction: 'approve' | 'reject' | 'delete'
 */
export const switchEmailMode = async (req: Request, res: Response): Promise<void> => {
  const handler = 'switchEmailMode';
  const companyId = (req as any).companyId;
  const { newMode, pendingAction } = req.body;

  try {
    // Validate inputs
    if (!['shadow', 'auto'].includes(newMode)) {
      sendErrorResponse(res, 400, 'newMode must be shadow or auto');
      return;
    }

    if (!['approve', 'reject', 'delete'].includes(pendingAction)) {
      sendErrorResponse(res, 400, 'pendingAction must be approve, reject, or delete');
      return;
    }

    const { getPendingEmails, rejectAllPending } = await import('../db/pilotQueuedEmails');
    const { insertRejectionTracking } = await import('../db/rejectionTracking');

    // Get all pending emails
    const pendingEmails = await getPendingEmails(companyId);

    let affectedCount = 0;

    // Handle pending emails based on action
    if (pendingAction === 'approve') {
      // Send all pending emails immediately
      const emailService = (await import('../services/emailService')).default;
      const { createEmailLog } = await import('../db/emailLogs');

      for (const email of pendingEmails) {
        try {
          const sendResult = await emailService.sendDunningEmail({
            companyId,
            invoiceId: email.invoice_id,
            customerId: email.customer_id,
            recipientEmail: email.recipient_email,
            customerName: email.customer_name,
            invoiceAmount: email.invoice_amount,
            dueDate: new Date(email.created_at).toISOString(),
            daysOverdue: email.days_overdue,
            emailType: email.email_type as 'dunning_1' | 'dunning_2' | 'dunning_3' | 'dunning_4' | 'dunning_5' | 'payment_plan_offer',
            attemptNumber: 1,
          });

          if (sendResult.success) {
            await createEmailLog({
              companyId,
              invoiceId: email.invoice_id,
              recipientEmail: email.recipient_email,
              subject: email.subject || '',
              body: email.body || '',
              emailType: email.email_type as any,
              sendgridMessageId: sendResult.sendgridMessageId,
            });

            await pool.query(
              `UPDATE pilot_queued_emails
               SET status = 'sent', sent_at = NOW(), resend_message_id = $1
               WHERE id = $2`,
              [sendResult.sendgridMessageId, email.id]
            );

            affectedCount++;
          }
        } catch (err) {
          logError(LOG_MODULE, handler, 'Failed to send email during mode switch', err);
        }
      }
    } else if (pendingAction === 'reject' || pendingAction === 'delete') {
      // Mark all pending as rejected + add to rejection_tracking (7-day block)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      for (const email of pendingEmails) {
        try {
          // Update status to rejected
          await pool.query(
            `UPDATE pilot_queued_emails SET status = 'rejected' WHERE id = $1`,
            [email.id]
          );

          // Insert into rejection_tracking (7-day block)
          await insertRejectionTracking({
            companyId,
            invoiceId: email.invoice_id,
            emailType: email.email_type,
            rejectedBy: 'system_mode_switch',
            reason: `Rejected during mode switch to ${newMode}`,
            expiresDays: 7,
          });

          affectedCount++;
        } catch (err) {
          logError(LOG_MODULE, handler, 'Failed to reject email during mode switch', err);
        }
      }
    }

    // Update company mode
    const updated = await updateCompany(companyId, { pilot_mode: newMode });

    logInfo(LOG_MODULE, handler, 'Email mode switched', {
      companyId,
      newMode,
      pendingAction,
      affectedCount,
    });

    res.status(200).json({
      data: {
        success: true,
        mode: newMode,
        affectedCount,
        message: `Switched to ${newMode} mode, handled ${affectedCount} pending emails (${pendingAction})`,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to switch email mode', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/settings/sms
 * Fetch current SMS settings for the company
 */
export const getSMSSettings = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getSMSSettings';
  const companyId = (req as any).companyId;

  try {
    const result = await pool.query(
      `SELECT sms_enabled, sms_tone, sms_day_threshold FROM companies WHERE id = $1`,
      [companyId]
    );

    if (result.rows.length === 0) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    const settings = result.rows[0];

    logInfo(LOG_MODULE, handler, 'SMS settings fetched', { companyId });

    res.status(200).json({
      data: {
        sms_enabled: settings.sms_enabled,
        sms_tone: settings.sms_tone,
        sms_day_threshold: settings.sms_day_threshold,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to fetch SMS settings', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PATCH /api/settings/sms
 * Update SMS settings for the company
 */
export const updateSMSSettings = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateSMSSettings';
  const companyId = (req as any).companyId;
  const { sms_enabled, sms_tone, sms_day_threshold } = req.body;

  try {
    // Validate inputs
    if (sms_enabled !== undefined && typeof sms_enabled !== 'boolean') {
      sendErrorResponse(res, 400, 'sms_enabled must be a boolean');
      return;
    }

    if (sms_tone !== undefined && !['friendly', 'professional', 'stern'].includes(sms_tone)) {
      sendErrorResponse(res, 400, 'sms_tone must be friendly, professional, or stern');
      return;
    }

    if (sms_day_threshold !== undefined) {
      const day = parseInt(sms_day_threshold);
      if (isNaN(day) || day < 1 || day > 90) {
        sendErrorResponse(res, 400, 'sms_day_threshold must be between 1 and 90');
        return;
      }
    }

    // Build update query dynamically based on provided fields
    const updateFields: string[] = [];
    const updateValues: any[] = [companyId];
    let paramIndex = 2;

    if (sms_enabled !== undefined) {
      updateFields.push(`sms_enabled = $${paramIndex++}`);
      updateValues.push(sms_enabled);
    }

    if (sms_tone !== undefined) {
      updateFields.push(`sms_tone = $${paramIndex++}`);
      updateValues.push(sms_tone);
    }

    if (sms_day_threshold !== undefined) {
      updateFields.push(`sms_day_threshold = $${paramIndex++}`);
      updateValues.push(parseInt(sms_day_threshold));
    }

    if (updateFields.length === 0) {
      sendErrorResponse(res, 400, 'No fields to update');
      return;
    }

    // Execute update
    await pool.query(
      `UPDATE companies SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $1`,
      updateValues
    );

    logInfo(LOG_MODULE, handler, 'SMS settings updated', {
      companyId,
      updatedFields: updateFields.length,
    });

    // Fetch updated settings
    const result = await pool.query(
      `SELECT sms_enabled, sms_tone, sms_day_threshold FROM companies WHERE id = $1`,
      [companyId]
    );

    const settings = result.rows[0];

    res.status(200).json({
      data: {
        message: 'SMS settings updated successfully',
        sms_enabled: settings.sms_enabled,
        sms_tone: settings.sms_tone,
        sms_day_threshold: settings.sms_day_threshold,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update SMS settings', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/settings/twilio
 * Get customer's Twilio configuration status
 */
export const getTwilioConfig = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getTwilioConfig';
  const companyId = (req as any).companyId;

  try {
    const company = await findCompanyById(companyId);
    if (!company) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    const configured = !!(company as any).twilio_configured;
    const phoneNumber = configured ? (company as any).twilio_phone_number : null;
    const lastVerifiedAt = configured ? (company as any).twilio_last_verified_at : null;

    res.status(200).json({
      data: {
        configured,
        phoneNumber,
        lastVerifiedAt,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to get Twilio config', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/settings/twilio/configure
 * Save customer's Twilio credentials (Account SID, Auth Token, Phone Number)
 */
export const configureTwilio = async (req: Request, res: Response): Promise<void> => {
  const handler = 'configureTwilio';
  const companyId = (req as any).companyId;
  const { accountSid, authToken, phoneNumber } = req.body;

  try {
    // Validate inputs
    if (!accountSid || !authToken || !phoneNumber) {
      sendErrorResponse(res, 400, 'accountSid, authToken, and phoneNumber are required');
      return;
    }

    if (!/^\+?[1-9]\d{7,14}$/.test(phoneNumber.replace(/[\s\-().]/g, ''))) {
      sendErrorResponse(res, 400, 'Invalid phone number format');
      return;
    }

    // Encrypt credentials
    const { encrypt } = await import('../utils/encryption');
    const encryptedSid = encrypt(accountSid);
    const encryptedToken = encrypt(authToken);

    // Update company with encrypted credentials
    const result = await pool.query(
      `UPDATE companies
       SET twilio_account_sid_encrypted = $1,
           twilio_auth_token_encrypted = $2,
           twilio_phone_number = $3,
           twilio_configured = true,
           twilio_last_verified_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING twilio_phone_number, twilio_last_verified_at`,
      [encryptedSid, encryptedToken, phoneNumber, companyId]
    );

    if (result.rows.length === 0) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    logInfo(LOG_MODULE, handler, 'Twilio credentials configured', {
      companyId,
      phoneNumber,
    });

    res.status(200).json({
      data: {
        message: 'Twilio credentials configured successfully',
        phoneNumber: result.rows[0].twilio_phone_number,
        lastVerifiedAt: result.rows[0].twilio_last_verified_at,
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to configure Twilio', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/settings/twilio/test
 * Test Twilio credentials by making API call
 */
export const testTwilio = async (req: Request, res: Response): Promise<void> => {
  const handler = 'testTwilio';
  const companyId = (req as any).companyId;
  const { accountSid, authToken, phoneNumber } = req.body;

  try {
    // Validate inputs
    if (!accountSid || !authToken || !phoneNumber) {
      sendErrorResponse(res, 400, 'accountSid, authToken, and phoneNumber are required');
      return;
    }

    const { encrypt } = await import('../utils/encryption');
    const { testTwilioCredentials } = await import('../services/smsService');

    // Encrypt for testing
    const encryptedSid = encrypt(accountSid);
    const encryptedToken = encrypt(authToken);

    // Test credentials
    const testResult = await testTwilioCredentials(encryptedSid, encryptedToken, phoneNumber);

    if (!testResult.valid) {
      res.status(400).json({
        data: {
          valid: false,
          error: testResult.error || 'Invalid Twilio credentials',
        },
      });
      return;
    }

    logInfo(LOG_MODULE, handler, 'Twilio credentials tested successfully', {
      companyId,
      phoneNumber,
    });

    res.status(200).json({
      data: {
        valid: true,
        message: 'Twilio credentials are valid',
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to test Twilio credentials', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/settings/twilio/disconnect
 * Remove customer's Twilio configuration
 */
export const disconnectTwilio = async (req: Request, res: Response): Promise<void> => {
  const handler = 'disconnectTwilio';
  const companyId = (req as any).companyId;

  try {
    const result = await pool.query(
      `UPDATE companies
       SET twilio_account_sid_encrypted = NULL,
           twilio_auth_token_encrypted = NULL,
           twilio_phone_number = NULL,
           twilio_configured = false,
           twilio_last_verified_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [companyId]
    );

    if (result.rows.length === 0) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    logInfo(LOG_MODULE, handler, 'Twilio configuration disconnected', { companyId });

    res.status(200).json({
      data: {
        message: 'Twilio configuration removed successfully',
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to disconnect Twilio', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PATCH /api/settings/sms/escalation
 * Update SMS escalation logic settings
 */
export const updateSMSEscalation = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateSMSEscalation';
  const companyId = (req as any).companyId;
  const { sms_escalation_enabled, sms_escalate_after_emails, sms_max_per_invoice } = req.body;

  try {
    const result = await pool.query(
      `UPDATE companies
       SET sms_escalation_enabled = COALESCE($1, sms_escalation_enabled),
           sms_escalate_after_emails = COALESCE($2, sms_escalate_after_emails),
           sms_max_per_invoice = COALESCE($3, sms_max_per_invoice),
           updated_at = NOW()
       WHERE id = $4
       RETURNING sms_escalation_enabled, sms_escalate_after_emails, sms_max_per_invoice`,
      [sms_escalation_enabled, sms_escalate_after_emails, sms_max_per_invoice, companyId]
    );

    if (result.rows.length === 0) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    logInfo(LOG_MODULE, handler, 'SMS escalation settings updated', { companyId });

    res.status(200).json({
      data: result.rows[0],
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update SMS escalation settings', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PATCH /api/settings/sms/retry
 * Update SMS retry settings
 */
export const updateSMSRetry = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateSMSRetry';
  const companyId = (req as any).companyId;
  const { sms_retry_enabled, sms_retry_hours, sms_max_retries } = req.body;

  try {
    const result = await pool.query(
      `UPDATE companies
       SET sms_retry_enabled = COALESCE($1, sms_retry_enabled),
           sms_retry_hours = COALESCE($2, sms_retry_hours),
           sms_max_retries = COALESCE($3, sms_max_retries),
           updated_at = NOW()
       WHERE id = $4
       RETURNING sms_retry_enabled, sms_retry_hours, sms_max_retries`,
      [sms_retry_enabled, sms_retry_hours, sms_max_retries, companyId]
    );

    if (result.rows.length === 0) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    logInfo(LOG_MODULE, handler, 'SMS retry settings updated', { companyId });

    res.status(200).json({
      data: result.rows[0],
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update SMS retry settings', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * PATCH /api/settings/sms/compliance
 * Update SMS compliance settings
 */
export const updateSMSCompliance = async (req: Request, res: Response): Promise<void> => {
  const handler = 'updateSMSCompliance';
  const companyId = (req as any).companyId;
  const { sms_tcpa_enabled, sms_weekend_blackout, sms_require_opt_in } = req.body;

  try {
    const result = await pool.query(
      `UPDATE companies
       SET sms_tcpa_enabled = COALESCE($1, sms_tcpa_enabled),
           sms_weekend_blackout = COALESCE($2, sms_weekend_blackout),
           sms_require_opt_in = COALESCE($3, sms_require_opt_in),
           updated_at = NOW()
       WHERE id = $4
       RETURNING sms_tcpa_enabled, sms_weekend_blackout, sms_require_opt_in`,
      [sms_tcpa_enabled, sms_weekend_blackout, sms_require_opt_in, companyId]
    );

    if (result.rows.length === 0) {
      sendErrorResponse(res, 404, 'Company not found');
      return;
    }

    logInfo(LOG_MODULE, handler, 'SMS compliance settings updated', { companyId });

    res.status(200).json({
      data: result.rows[0],
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to update SMS compliance settings', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * GET /api/settings/sms/opt-outs
 * Get list of customers who opted out of SMS
 */
export const getSMSOptOuts = async (req: Request, res: Response): Promise<void> => {
  const handler = 'getSMSOptOuts';
  const companyId = (req as any).companyId;

  try {
    const result = await pool.query(
      `SELECT
        id,
        customer_id,
        phone_number,
        opted_out_at,
        reason
       FROM sms_opt_outs
       WHERE company_id = $1
       ORDER BY opted_out_at DESC`,
      [companyId]
    );

    logInfo(LOG_MODULE, handler, `Retrieved ${result.rows.length} SMS opt-outs`, { companyId });

    res.status(200).json({
      data: result.rows,
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to retrieve SMS opt-outs', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

/**
 * POST /api/settings/sms/opt-outs/:customerId/re-enable
 * Re-opt customer into SMS
 */
export const reOptInSMS = async (req: Request, res: Response): Promise<void> => {
  const handler = 'reOptInSMS';
  const companyId = (req as any).companyId;
  const { customerId } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM sms_opt_outs
       WHERE company_id = $1 AND customer_id = $2
       RETURNING id`,
      [companyId, customerId]
    );

    if (result.rows.length === 0) {
      sendErrorResponse(res, 404, 'Customer not found in opt-out list');
      return;
    }

    logInfo(LOG_MODULE, handler, 'Customer re-opted into SMS', { companyId, customerId });

    res.status(200).json({
      data: {
        message: 'Customer re-opted into SMS successfully',
      },
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Failed to re-opt customer', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};
import { logInfo, logError } from '../utils/logger';
import * as CompanyDB from '../db/companies';
import { pool } from '../config/database';
import { hasRecentUnreadSystemAlert } from '../db/notificationEvents';
import {
  logStripeNotConnectedNotification,
  logEmailNotConfiguredNotification,
  logTwilioNotConfiguredNotification,
} from '../utils/notificationLogger';

/**
 * Check system health and log notifications for critical missing integrations
 * Call this periodically or when user accesses dashboard
 */
export async function checkAndNotifySystemHealth(companyId: string): Promise<void> {
  const method = 'checkAndNotifySystemHealth';

  try {
    // Get company details
    const company = await CompanyDB.findCompanyById(companyId);
    if (!company) {
      logError('systemHealthService', method, 'Company not found', undefined, { companyId });
      return;
    }

    // Check Stripe connection
    if (!company.stripe_account_id) {
      // Only create notification if no recent unread alert exists
      const hasRecentAlert = await hasRecentUnreadSystemAlert(companyId, 'stripe_not_connected');
      if (!hasRecentAlert) {
        logInfo('systemHealthService', method, 'Stripe not connected, logging notification', { companyId });
        try {
          await logStripeNotConnectedNotification(companyId);
        } catch (err) {
          logError('systemHealthService', method, 'Failed to log Stripe alert (non-blocking)', err);
        }
      }
    }

    // Check Email configuration (check if custom SMTP has been verified)
    const hasEmailConfig = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM companies WHERE id = $1 AND smtp_verified = true)`,
      [companyId]
    );
    const emailConfigured = hasEmailConfig.rows[0]?.exists || false;

    if (!emailConfigured) {
      // Only create notification if no recent unread alert exists
      const hasRecentAlert = await hasRecentUnreadSystemAlert(companyId, 'email_not_configured');
      if (!hasRecentAlert) {
        logInfo('systemHealthService', method, 'Email not configured, logging notification', { companyId });
        try {
          await logEmailNotConfiguredNotification(companyId);
        } catch (err) {
          logError('systemHealthService', method, 'Failed to log email alert (non-blocking)', err);
        }
      }
    }

    // Check Twilio configuration (if SMS is enabled)
    const isSmsEnabled = company.sms_enabled || false;
    const isTwilioConfigured = company.twilio_configured || false;
    if (isSmsEnabled && !isTwilioConfigured) {
      // Only create notification if no recent unread alert exists
      const hasRecentAlert = await hasRecentUnreadSystemAlert(companyId, 'sms_not_configured');
      if (!hasRecentAlert) {
        logInfo('systemHealthService', method, 'Twilio not configured, logging notification', { companyId });
        try {
          await logTwilioNotConfiguredNotification(companyId);
        } catch (err) {
          logError('systemHealthService', method, 'Failed to log Twilio alert (non-blocking)', err);
        }
      }
    }

    logInfo('systemHealthService', method, 'System health check completed', { companyId });
  } catch (err) {
    logError('systemHealthService', method, 'System health check failed', err);
    // Don't throw - this is a non-critical background check
  }
}

/**
 * Get current system health status for a company
 * Returns which critical integrations are missing
 */
export async function getSystemHealthStatus(companyId: string): Promise<{
  stripe_connected: boolean;
  email_configured: boolean;
  agent_can_operate: boolean;
}> {
  const method = 'getSystemHealthStatus';
  try {
    const company = await CompanyDB.findCompanyById(companyId);
    if (!company) {
      return {
        stripe_connected: false,
        email_configured: false,
        agent_can_operate: false,
      };
    }

    const stripeConnected = !!company.stripe_account_id;

    // Check if email is configured (has SMTP host or mail from address)
    const emailConfigResult = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM companies WHERE id = $1 AND (smtp_host IS NOT NULL OR mail_from_email IS NOT NULL)) as has_email`,
      [companyId]
    );
    const emailConfigured = emailConfigResult.rows[0]?.has_email || false;

    return {
      stripe_connected: stripeConnected,
      email_configured: emailConfigured,
      agent_can_operate: stripeConnected && emailConfigured,
    };
  } catch (err) {
    logError('systemHealthService', method, 'Failed to get health status', err);
    return {
      stripe_connected: false,
      email_configured: false,
      agent_can_operate: false,
    };
  }
}

import { createNotificationEvent, hasRecentUnreadSystemAlert } from '../db/notificationEvents';

/**
 * Helper functions to create notifications at specific events
 * Used throughout the backend to log important system events
 */

/**
 * Log when a payment is received
 */
export async function logPaymentReceivedNotification(
  companyId: string,
  customerName: string,
  amount: number,
  currency: string = 'USD'
): Promise<void> {
  try {
    await createNotificationEvent(
      companyId,
      'payment_received',
      `Payment received from ${customerName}`,
      {
        message: `$${amount.toLocaleString()} ${currency} payment received`,
        icon: '💰',
        priority: 'warning',
        action_url: '/dashboard',
        action_label: 'View Dashboard',
        metadata: {
          event_type: 'payment',
          customer_name: customerName,
          amount,
          currency,
        },
      }
    );
  } catch (err) {
    console.error('Error logging payment notification:', err);
    // Don't throw - logging failures shouldn't break main flow
  }
}

/**
 * Log when an email bounces (hard failure)
 */
export async function logEmailBouncedNotification(
  companyId: string,
  customerName: string,
  recipientEmail: string,
  reason?: string
): Promise<void> {
  try {
    await createNotificationEvent(
      companyId,
      'email_bounced',
      `Email bounced to ${recipientEmail}`,
      {
        message: `Email to ${customerName} failed: ${reason || 'Undeliverable'}. May need retry or manual contact.`,
        icon: '🚨',
        priority: 'warning',
        action_url: '/activity',
        action_label: 'Review Activity',
        metadata: {
          event_type: 'email_failure',
          customer_name: customerName,
          recipient_email: recipientEmail,
          reason,
        },
      }
    );
  } catch (err) {
    console.error('Error logging bounce notification:', err);
  }
}

/**
 * Log when agent pauses (error or manual pause)
 */
export async function logAgentPausedNotification(
  companyId: string,
  reason: string
): Promise<void> {
  try {
    await createNotificationEvent(
      companyId,
      'agent_paused',
      'Agent paused',
      {
        message: `Agent paused: ${reason}. Check settings to resume.`,
        icon: '⏸',
        priority: 'critical',
        action_url: '/settings',
        action_label: 'Review Settings',
        metadata: {
          event_type: 'agent_pause',
          reason,
        },
      }
    );
  } catch (err) {
    console.error('Error logging agent paused notification:', err);
  }
}

/**
 * Log when trial is ending soon
 */
export async function logTrialEndingNotification(
  companyId: string,
  daysRemaining: number
): Promise<void> {
  try {
    await createNotificationEvent(
      companyId,
      'trial_ending',
      `⏰ Trial ending in ${daysRemaining} days`,
      {
        message: `Your free trial ends in ${daysRemaining} days. Upgrade to continue using RecoverAI.`,
        icon: '⏰',
        priority: 'critical',
        action_url: '/settings?tab=billing',
        action_label: 'Upgrade Now',
        metadata: {
          event_type: 'trial_warning',
          days_remaining: daysRemaining,
        },
      }
    );
  } catch (err) {
    console.error('Error logging trial ending notification:', err);
  }
}

/**
 * Log when trial has ended (payment needed)
 */
export async function logTrialExpiredNotification(companyId: string): Promise<void> {
  try {
    await createNotificationEvent(
      companyId,
      'trial_expired',
      '❌ Trial ended - payment required',
      {
        message: 'Your free trial has ended. Please upgrade to continue using RecoverAI.',
        icon: '❌',
        priority: 'critical',
        action_url: '/settings?tab=billing',
        action_label: 'Upgrade Now',
        metadata: {
          event_type: 'trial_expired',
        },
      }
    );
  } catch (err) {
    console.error('Error logging trial expired notification:', err);
  }
}

/**
 * Log when emails are pending approval (Shadow mode queue)
 */
export async function logEmailsPendingApprovalNotification(
  companyId: string,
  pendingCount: number
): Promise<void> {
  try {
    await createNotificationEvent(
      companyId,
      'emails_pending',
      `✉️ ${pendingCount} emails waiting for your approval`,
      {
        message: `Review and approve ${pendingCount} pending dunning emails. These are blocking the agent until approved.`,
        icon: '✉️',
        priority: 'warning',
        action_url: '/invoices?filter=queued_approval',
        action_label: 'Review Emails',
        metadata: {
          event_type: 'emails_pending_approval',
          pending_count: pendingCount,
        },
      }
    );
  } catch (err) {
    console.error('Error logging emails pending notification:', err);
  }
}

/**
 * Backward compatibility alias
 */
export const logDailyActionsAvailableNotification = logEmailsPendingApprovalNotification;

/**
 * Log Stripe not connected (critical system alert)
 * Only creates if one doesn't already exist (deduplication)
 */
export async function logStripeNotConnectedNotification(companyId: string): Promise<void> {
  try {
    const exists = await hasRecentUnreadSystemAlert(companyId, 'stripe_disconnected');
    if (exists) {
      // Already have an unread alert for this in the last hour, skip
      return;
    }

    await createNotificationEvent(
      companyId,
      'system_alert',
      'Stripe not connected',
      {
        message: 'Your Stripe account is not connected. Agent is paused. Reconnect to resume.',
        icon: '🔴',
        priority: 'critical',
        action_url: '/settings?tab=integrations',
        action_label: 'Connect Stripe',
        metadata: {
          event_type: 'stripe_disconnected',
        },
      }
    );
  } catch (err) {
    console.error('Error logging Stripe notification:', err);
  }
}

/**
 * Log email not configured (critical system alert)
 * Only creates if one doesn't already exist (deduplication)
 */
export async function logEmailNotConfiguredNotification(companyId: string): Promise<void> {
  try {
    const exists = await hasRecentUnreadSystemAlert(companyId, 'email_not_configured');
    if (exists) {
      // Already have an unread alert for this in the last hour, skip
      return;
    }

    await createNotificationEvent(
      companyId,
      'system_alert',
      'Email not configured',
      {
        message: 'Email is not configured. Agent cannot send emails. Set up custom SMTP or use RecoverAI domain.',
        icon: '📧',
        priority: 'critical',
        action_url: '/settings?tab=email',
        action_label: 'Setup Email',
        metadata: {
          event_type: 'email_not_configured',
        },
      }
    );
  } catch (err) {
    console.error('Error logging email notification:', err);
  }
}

/**
 * Log Twilio not configured (critical system alert for SMS escalation)
 * Only creates if one doesn't already exist (deduplication)
 */
export async function logTwilioNotConfiguredNotification(companyId: string): Promise<void> {
  try {
    const exists = await hasRecentUnreadSystemAlert(companyId, 'twilio_not_configured');
    if (exists) {
      // Already have an unread alert for this in the last hour, skip
      return;
    }

    await createNotificationEvent(
      companyId,
      'system_alert',
      'SMS not configured',
      {
        message: 'SMS escalation is enabled but Twilio is not connected. Agent cannot send SMS. Connect Twilio to enable SMS recovery escalation.',
        icon: '📱',
        priority: 'critical',
        action_url: '/settings?tab=integrations',
        action_label: 'Connect Twilio',
        metadata: {
          event_type: 'twilio_not_configured',
        },
      }
    );
  } catch (err) {
    console.error('Error logging Twilio notification:', err);
  }
}

/**
 * Log when SMS delivery fails
 */
export async function logSmsFailedNotification(
  companyId: string,
  customerName: string,
  phone: string,
  reason?: string
): Promise<void> {
  try {
    await createNotificationEvent(
      companyId,
      'sms_failed',
      `SMS failed to ${phone}`,
      {
        message: `SMS to ${customerName} at ${phone} failed. Reason: ${reason || 'Unknown'}. Manual follow-up may be needed.`,
        icon: '🚨',
        priority: 'warning',
        action_url: '/activity',
        action_label: 'Review Activity',
        metadata: {
          event_type: 'sms_failure',
          customer_name: customerName,
          phone,
          reason,
        },
      }
    );
  } catch (err) {
    console.error('Error logging SMS failed notification:', err);
  }
}

/**
 * Log risk score change (informational)
 */
export async function logRiskScoreChangedNotification(
  companyId: string,
  customerName: string,
  oldScore: number,
  newScore: number
): Promise<void> {
  try {
    const changed = newScore > oldScore ? 'increased' : 'decreased';
    await createNotificationEvent(
      companyId,
      'risk_changed',
      `📈 Risk score ${changed} for ${customerName}`,
      {
        message: `Risk score changed from ${oldScore} to ${newScore}. Review recovery strategy.`,
        icon: newScore > 70 ? '🔴' : newScore > 50 ? '🟠' : '🟡',
        priority: 'info',
        action_url: '/customers',
        action_label: 'View Customers',
        metadata: {
          event_type: 'risk_change',
          customer_name: customerName,
          old_score: oldScore,
          new_score: newScore,
        },
      }
    );
  } catch (err) {
    console.error('Error logging risk score notification:', err);
  }
}

/**
 * Log when contact info is invalid (email bounced or SMS failed permanently)
 */
export async function logContactInvalidNotification(
  companyId: string,
  customerName: string,
  contactInfo: string,  // email or phone
  contactType: 'email' | 'sms',
  reason?: string
): Promise<void> {
  try {
    const icon = contactType === 'email' ? '📧' : '📱';
    const title = contactType === 'email' ? `Email bounced: ${contactInfo}` : `SMS failed: ${contactInfo}`;
    const message = `${contactType === 'email' ? 'Email' : 'SMS'} to ${customerName} at ${contactInfo} failed permanently. ${reason || 'Invalid contact info'}. Please update.`;

    await createNotificationEvent(
      companyId,
      'contact_invalid',
      `${icon} ${title}`,
      {
        message,
        icon,
        priority: 'warning',
        action_url: `/customers?search=${encodeURIComponent(customerName)}`,
        action_label: 'Update Contact',
        metadata: {
          event_type: 'contact_invalid',
          customer_name: customerName,
          contact_info: contactInfo,
          contact_type: contactType,
          reason,
        },
      }
    );
  } catch (err) {
    console.error('Error logging contact invalid notification:', err);
  }
}

/**
 * Log agent run completion
 */
export async function logAgentRunCompletedNotification(
  companyId: string,
  emailsQueued: number,
  paymentsDetected: number
): Promise<void> {
  try {
    await createNotificationEvent(
      companyId,
      'agent_run',
      `🤖 Agent run completed`,
      {
        message: `${emailsQueued} emails queued, ${paymentsDetected} payments detected. Review in Activity.`,
        icon: '🤖',
        priority: 'info',
        action_url: '/activity',
        action_label: 'View Activity',
        metadata: {
          event_type: 'agent_run',
          emails_queued: emailsQueued,
          payments_detected: paymentsDetected,
        },
      }
    );
  } catch (err) {
    console.error('Error logging agent run notification:', err);
  }
}

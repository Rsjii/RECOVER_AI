import { pool } from '../config/database';

export interface NotificationPreferences {
  id: string;
  company_id: string;
  system_alerts: boolean;
  daily_actions: boolean;
  daily_actions_email: boolean;
  daily_actions_time: string;
  agent_activity: boolean;
  agent_activity_email: boolean;
  payment_received: boolean;
  payment_received_email: boolean;
  weekly_digest: boolean;
  weekly_digest_day: string;
  weekly_digest_time: string;
  monthly_report: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get notification preferences for a company
 * If no preferences exist, returns defaults
 */
export async function getNotificationPreferences(companyId: string): Promise<NotificationPreferences> {
  try {
    const result = await pool.query<NotificationPreferences>(
      `SELECT * FROM notification_preferences WHERE company_id = $1`,
      [companyId]
    );

    if (result.rows.length > 0) {
      return result.rows[0];
    }

    // Return defaults if no row exists
    return {
      id: '',
      company_id: companyId,
      system_alerts: true,
      daily_actions: true,
      daily_actions_email: true,
      daily_actions_time: '09:00',
      agent_activity: true,
      agent_activity_email: false,
      payment_received: true,
      payment_received_email: true,
      weekly_digest: true,
      weekly_digest_day: 'Monday',
      weekly_digest_time: '09:00',
      monthly_report: true,
      quiet_hours_enabled: false,
      quiet_hours_start: '21:00',
      quiet_hours_end: '06:00',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error getting notification preferences:', err);
    throw err;
  }
}

/**
 * Upsert notification preferences for a company
 */
export async function upsertNotificationPreferences(
  companyId: string,
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  try {
    const result = await pool.query<NotificationPreferences>(
      `INSERT INTO notification_preferences (
        company_id,
        system_alerts,
        daily_actions,
        daily_actions_email,
        daily_actions_time,
        agent_activity,
        agent_activity_email,
        payment_received,
        payment_received_email,
        weekly_digest,
        weekly_digest_day,
        weekly_digest_time,
        monthly_report,
        quiet_hours_enabled,
        quiet_hours_start,
        quiet_hours_end,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      ON CONFLICT (company_id) DO UPDATE SET
        system_alerts = COALESCE($2::boolean, notification_preferences.system_alerts),
        daily_actions = COALESCE($3::boolean, notification_preferences.daily_actions),
        daily_actions_email = COALESCE($4::boolean, notification_preferences.daily_actions_email),
        daily_actions_time = COALESCE($5::text, notification_preferences.daily_actions_time),
        agent_activity = COALESCE($6::boolean, notification_preferences.agent_activity),
        agent_activity_email = COALESCE($7::boolean, notification_preferences.agent_activity_email),
        payment_received = COALESCE($8::boolean, notification_preferences.payment_received),
        payment_received_email = COALESCE($9::boolean, notification_preferences.payment_received_email),
        weekly_digest = COALESCE($10::boolean, notification_preferences.weekly_digest),
        weekly_digest_day = COALESCE($11::text, notification_preferences.weekly_digest_day),
        weekly_digest_time = COALESCE($12::text, notification_preferences.weekly_digest_time),
        monthly_report = COALESCE($13::boolean, notification_preferences.monthly_report),
        quiet_hours_enabled = COALESCE($14::boolean, notification_preferences.quiet_hours_enabled),
        quiet_hours_start = COALESCE($15::text, notification_preferences.quiet_hours_start),
        quiet_hours_end = COALESCE($16::text, notification_preferences.quiet_hours_end),
        updated_at = NOW()
      RETURNING *`,
      [
        companyId,
        prefs.system_alerts ?? true,
        prefs.daily_actions ?? true,
        prefs.daily_actions_email ?? true,
        prefs.daily_actions_time ?? '09:00',
        prefs.agent_activity ?? true,
        prefs.agent_activity_email ?? false,
        prefs.payment_received ?? true,
        prefs.payment_received_email ?? true,
        prefs.weekly_digest ?? true,
        prefs.weekly_digest_day ?? 'Monday',
        prefs.weekly_digest_time ?? '09:00',
        prefs.monthly_report ?? true,
        prefs.quiet_hours_enabled ?? false,
        prefs.quiet_hours_start ?? '21:00',
        prefs.quiet_hours_end ?? '06:00',
      ]
    );

    return result.rows[0];
  } catch (err) {
    console.error('Error upserting notification preferences:', err);
    throw err;
  }
}

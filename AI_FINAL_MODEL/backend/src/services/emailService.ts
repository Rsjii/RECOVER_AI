import { Resend } from 'resend';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { db } from '../config/db';

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
};

const RISK_LABELS: Record<string, string> = {
  critical: '🔴 CRITICAL',
  high:     '🟠 HIGH',
  medium:   '🟡 MEDIUM',
  low:      '🟢 LOW',
};

export const emailService = {
  async sendInvite(email: string, token: string, orgName: string): Promise<void> {
    if (!resend) {
      logger.warn('[Email] Resend API key not configured, skipping invite email');
      return;
    }
    const inviteUrl = `${config.frontendUrl}/invite/${token}`;
    try {
      await resend.emails.send({
        from:    config.emailFrom || 'Codebase Memory <onboarding@resend.dev>',
        to:      email,
        subject: `You're invited to join ${orgName} on Codebase Memory`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#060910;padding:32px;border-radius:12px">
            <h2 style="color:#fff;margin:0 0 8px">You've been invited to ${orgName}</h2>
            <p style="color:#94a3b8;margin:0 0 24px;font-size:14px">
              Click the link below to join your team on Codebase Memory:
            </p>
            <a href="${inviteUrl}"
               style="background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-bottom:24px;font-weight:600;font-size:14px">
              Accept Invitation →
            </a>
            <p style="color:#475569;font-size:12px;margin:0">This link expires in 7 days.</p>
          </div>
        `,
      });
    } catch (err: any) {
      logger.error({ err }, '[Email] Failed to send invite');
    }
  },

  /**
   * Send PR analysis notification — respects org notification preferences.
   * Call this from your PR analysis job after analysis is complete.
   */
  async sendPRAnalysisNotification(params: {
    orgId:       string;
    riskLevel:   string;
    prTitle:     string;
    prNumber:    number;
    prUrl:       string;
    repoName:    string;
    author:      string;
    analysisUrl: string;
  }): Promise<void> {
    if (!resend) {
      logger.warn('[Email] Resend API key not configured, skipping PR notification');
      return;
    }

    try {
      // 1. Get org notification preferences
      const orgRes = await db.query(
        `SELECT email_notifications_enabled, notify_on_critical, notify_on_high,
                notify_recipients, github_org_name
         FROM organizations WHERE id = $1`,
        [params.orgId]
      );
      const org = orgRes.rows[0];
      if (!org) return;

      // 2. Master toggle
      if (!org.email_notifications_enabled) return;

      // 3. Risk-level filter
      const risk = params.riskLevel.toLowerCase();
      if (risk === 'critical' && !org.notify_on_critical) return;
      if (risk === 'high'     && !org.notify_on_high)     return;
      if (risk === 'medium' || risk === 'low')             return; // never notify on medium/low

      // 4. Resolve recipients
      const recipientQueries: Record<string, string> = {
        all: `
          SELECT u.email FROM team_members tm
          JOIN users u ON u.id = tm.user_id
          WHERE tm.org_id = $1 AND u.email IS NOT NULL`,
        reviewers_admins: `
          SELECT u.email FROM team_members tm
          JOIN users u ON u.id = tm.user_id
          WHERE tm.org_id = $1 AND tm.role IN ('admin','reviewer') AND u.email IS NOT NULL`,
        admins: `
          SELECT u.email FROM team_members tm
          JOIN users u ON u.id = tm.user_id
          WHERE tm.org_id = $1 AND tm.role = 'admin' AND u.email IS NOT NULL`,
      };
      const query = recipientQueries[org.notify_recipients] || recipientQueries['admins'];
      const recipientsRes = await db.query(query, [params.orgId]);
      const emails: string[] = recipientsRes.rows.map((r: any) => r.email).filter(Boolean);
      if (!emails.length) return;

      // 5. Send
      const riskColor = RISK_COLORS[risk] || '#6b7280';
      const riskLabel = RISK_LABELS[risk]  || risk.toUpperCase();

      await resend.emails.send({
        from:    config.emailFrom || 'Codebase Memory <onboarding@resend.dev>',
        to:      emails,
        subject: `[${riskLabel}] PR #${params.prNumber}: ${params.prTitle}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#0d1424;border-radius:12px;padding:24px;border:1px solid #1e293b">
              <p style="margin:0 0 4px">
                <span style="color:${riskColor};font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">
                  ${riskLabel}
                </span>
              </p>
              <h2 style="color:#fff;margin:4px 0 6px;font-size:18px">
                PR #${params.prNumber}: ${params.prTitle}
              </h2>
              <p style="color:#64748b;font-size:12px;margin:0 0 20px">
                ${params.repoName} · by ${params.author}
              </p>

              <div style="display:flex;gap:12px;margin-bottom:24px">
                <a href="${params.analysisUrl}"
                   style="background:#4f46e5;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">
                  View Full Analysis →
                </a>
                <a href="${params.prUrl}"
                   style="background:#1e293b;color:#94a3b8;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;border:1px solid #334155">
                  View on GitHub
                </a>
              </div>

              <p style="color:#334155;font-size:11px;margin:0;border-top:1px solid #1e293b;padding-top:16px">
                Codebase Memory · ${org.github_org_name} ·
                <a href="${config.frontendUrl}/admin/settings?tab=notifications"
                   style="color:#4f46e5;text-decoration:none">Manage notifications</a>
              </p>
            </div>
          </div>
        `,
      });

      logger.info(
        { orgId: params.orgId, prNumber: params.prNumber, recipients: emails.length },
        '[Email] PR notification sent'
      );
    } catch (err: any) {
      logger.error({ err }, '[Email] Failed to send PR notification');
    }
  },
};

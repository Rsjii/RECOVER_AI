import { Request, Response } from 'express';
import { db } from '../../config/db';
import { logger } from '../../config/logger';
import { historicalIndexQueue } from '../../jobs/eosQueue';

export async function getOnboardingStatus(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;

    // Get onboarding state
    const state = await db.query(
      `SELECT * FROM onboarding_state WHERE org_id = $1`,
      [orgId]
    );

    // Check GitHub App connected
    const org = await db.query(
      `SELECT github_app_installation_id FROM organizations WHERE id = $1`,
      [orgId]
    );
    const githubConnected = !!org.rows[0]?.github_app_installation_id;

    // Check Jira connected
    const jira = await db.query(
      `SELECT cloud_id FROM jira_connections WHERE org_id = $1`,
      [orgId]
    );
    const jiraConnected = !!jira.rows[0]?.cloud_id;

    // Check team mapping done
    const mappings = await db.query(
      `SELECT COUNT(*) as count FROM team_member_mappings WHERE org_id = $1`,
      [orgId]
    );
    const teamMapped = parseInt(mappings.rows[0]?.count) > 0;

    // Check brief config saved
    const config = await db.query(
      `SELECT id FROM brief_config WHERE org_id = $1`,
      [orgId]
    );
    const configured = !!config.rows[0];

    const s = state.rows[0] || {};
    res.json({
      step_github:      githubConnected,
      step_jira:        jiraConnected,
      step_team_mapped: teamMapped,
      step_configured:  configured,
      step_previewed:   s.step_previewed || false,
      completed:        s.completed || false,
      index_progress:   s.index_progress || 0,
      index_message:    s.index_message || '',
    });
  } catch (err) {
    logger.error({ err }, '[Onboarding] getStatus error');
    res.status(500).json({ error: 'Failed to get onboarding status' });
  }
}

export async function getIndexProgress(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const state = await db.query(
      `SELECT index_progress, index_message, completed FROM onboarding_state WHERE org_id = $1`,
      [orgId]
    );
    const row = state.rows[0] || { index_progress: 0, index_message: '', completed: false };
    res.json({
      progress: row.index_progress,
      message:  row.index_message,
      done:     row.completed,
    });
  } catch (err) {
    logger.error({ err }, '[Onboarding] getProgress error');
    res.status(500).json({ error: 'Failed to get progress' });
  }
}

export async function configureBrief(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const {
      delivery_time = '08:00',
      delivery_timezone = 'UTC',
      slack_enabled = true,
      email_enabled = false,
      stale_pr_days = 3,
      sprint_risk_threshold = 40,
      silent_engineer_days = 3,
      slack_webhook_url,
    } = req.body;

    await db.query(
      `INSERT INTO brief_config
         (org_id, delivery_time, delivery_timezone, slack_enabled, email_enabled,
          stale_pr_days, sprint_risk_threshold, silent_engineer_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (org_id) DO UPDATE SET
         delivery_time = $2, delivery_timezone = $3,
         slack_enabled = $4, email_enabled = $5,
         stale_pr_days = $6, sprint_risk_threshold = $7,
         silent_engineer_days = $8, updated_at = NOW()`,
      [orgId, delivery_time, delivery_timezone, slack_enabled, email_enabled,
       stale_pr_days, sprint_risk_threshold, silent_engineer_days]
    );

    // If webhook URL provided, save it
    if (slack_webhook_url) {
      await db.query(
        `INSERT INTO slack_connections (org_id, webhook_url, is_active)
         VALUES ($1, $2, true)
         ON CONFLICT (org_id) DO UPDATE SET webhook_url = $2, is_active = true, updated_at = NOW()`,
        [orgId, slack_webhook_url]
      );
    }

    await db.query(
      `INSERT INTO onboarding_state (org_id, step_configured) VALUES ($1, true)
       ON CONFLICT (org_id) DO UPDATE SET step_configured = true, updated_at = NOW()`,
      [orgId]
    );

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[Onboarding] configure error');
    res.status(500).json({ error: 'Failed to save brief config' });
  }
}

export async function completeOnboarding(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;

    await db.query(
      `INSERT INTO onboarding_state (org_id, completed, index_started_at, index_progress, index_message)
       VALUES ($1, false, NOW(), 0, 'Starting 180-day historical index...')
       ON CONFLICT (org_id) DO UPDATE SET
         completed = false, index_started_at = NOW(),
         index_progress = 0, index_message = 'Starting 180-day historical index...',
         updated_at = NOW()`,
      [orgId]
    );

    // Queue the historical index job
    await historicalIndexQueue.add('historical-index', { orgId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30000 },
    });

    res.json({ ok: true, message: 'Historical index started. Takes 5–15 minutes.' });
  } catch (err) {
    logger.error({ err }, '[Onboarding] complete error');
    res.status(500).json({ error: 'Failed to start indexing' });
  }
}

export async function getBriefConfig(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const { rows } = await db.query(
      `SELECT delivery_time, delivery_timezone, slack_enabled, email_enabled,
              stale_pr_days, sprint_risk_threshold, silent_engineer_days
       FROM brief_config WHERE org_id = $1`,
      [orgId]
    );
    res.json(rows[0] ?? {
      delivery_time: '08:00',
      delivery_timezone: 'UTC',
      slack_enabled: true,
      email_enabled: false,
      stale_pr_days: 3,
      sprint_risk_threshold: 40,
      silent_engineer_days: 3,
    });
  } catch (err) {
    logger.error({ err }, '[Onboarding] getBriefConfig error');
    res.status(500).json({ error: 'Failed to get brief config' });
  }
}

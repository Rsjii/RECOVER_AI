import { Request, Response } from 'express';
import { db } from '../../config/db';
import { logger } from '../../config/logger';
import { jiraOAuthService } from '../../services/jiraOAuthService';
import { jiraService } from '../../services/jiraService';
import { logActivity } from '../../lib/activity';

export async function connectJira(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const authUrl = jiraOAuthService.getAuthorizationUrl(orgId);
    res.redirect(authUrl);
  } catch (err) {
    logger.error({ err }, '[Jira] connect error');
    res.status(500).json({ error: 'Failed to initiate Jira connection' });
  }
}

export async function jiraCallback(req: Request, res: Response) {
  const { code, state, error } = req.query as Record<string, string>;
  const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';

  if (error) {
    logger.warn({ error }, '[Jira] OAuth error from Atlassian');
    return res.redirect(`${frontendUrl}/onboarding?step=2&error=${encodeURIComponent(error)}`);
  }

  try {
    await jiraOAuthService.exchangeCodeForTokens(code, state);
    return res.redirect(`${frontendUrl}/onboarding?step=2&connected=true`);
  } catch (err) {
    logger.error({ err }, '[Jira] callback token exchange error');
    return res.redirect(`${frontendUrl}/onboarding?step=2&error=token_exchange_failed`);
  }
}

export async function getJiraSites(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const sites = await jiraService.getSites(orgId);
    res.json(sites);
  } catch (err) {
    logger.error({ err }, '[Jira] getSites error');
    res.status(500).json({ error: 'Failed to fetch Jira sites' });
  }
}

export async function selectJiraSite(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const { cloudId, siteUrl } = req.body as { cloudId: string; siteUrl: string };

    await db.query(
      `UPDATE jira_connections SET cloud_id = $1, site_url = $2, updated_at = NOW()
       WHERE org_id = $3`,
      [cloudId, siteUrl, orgId]
    );

    logActivity(orgId, (req as any).user?.id, 'jira_site_selected', `Selected Jira site: ${siteUrl}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[Jira] selectSite error');
    res.status(500).json({ error: 'Failed to select Jira site' });
  }
}

export async function getJiraProjects(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const projects = await jiraService.getProjects(orgId);
    res.json(projects);
  } catch (err) {
    logger.error({ err }, '[Jira] getProjects error');
    res.status(500).json({ error: 'Failed to fetch Jira projects' });
  }
}

export async function selectJiraProjects(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const { projectKeys } = req.body as { projectKeys: string[] };

    if (!projectKeys?.length) return res.status(400).json({ error: 'projectKeys required' });

    // Get full project details for selected keys
    const projects = await jiraService.getProjects(orgId);
    const selected = projects.filter((p: any) => projectKeys.includes(p.key));

    // Upsert into jira_projects
    for (const p of selected as any[]) {
      await db.query(
        `INSERT INTO jira_projects (org_id, jira_project_id, project_key, project_name, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (org_id, project_key) DO UPDATE SET is_active = true, project_name = EXCLUDED.project_name`,
        [orgId, p.id, p.key, p.name]
      );
    }

    // Deactivate any previously selected projects not in current selection
    await db.query(
      `UPDATE jira_projects SET is_active = false
       WHERE org_id = $1 AND project_key != ALL($2::text[])`,
      [orgId, projectKeys]
    );

    // Advance onboarding: mark jira step done
    await db.query(
      `INSERT INTO onboarding_state (org_id, step_jira) VALUES ($1, true)
       ON CONFLICT (org_id) DO UPDATE SET step_jira = true, updated_at = NOW()`,
      [orgId]
    );

    logActivity(orgId, (req as any).user?.id, 'jira_projects_selected', `Selected ${selected.length} Jira projects`);
    res.json({ ok: true, count: selected.length });
  } catch (err) {
    logger.error({ err }, '[Jira] selectProjects error');
    res.status(500).json({ error: 'Failed to select Jira projects' });
  }
}

export async function getJiraStatus(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const conn = await db.query(
      `SELECT cloud_id, site_url, expires_at FROM jira_connections WHERE org_id = $1`,
      [orgId]
    );

    if (!conn.rows[0]) return res.json({ connected: false });

    const projects = await db.query(
      `SELECT project_key, project_name, is_active FROM jira_projects WHERE org_id = $1`,
      [orgId]
    );

    res.json({
      connected: true,
      site_url: conn.rows[0].site_url,
      token_expiry: conn.rows[0].expires_at,
      projects: projects.rows,
    });
  } catch (err) {
    logger.error({ err }, '[Jira] getStatus error');
    res.status(500).json({ error: 'Failed to get Jira status' });
  }
}

export async function disconnectJira(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    await db.query(`DELETE FROM jira_connections WHERE org_id = $1`, [orgId]);
    await db.query(`DELETE FROM jira_projects WHERE org_id = $1`, [orgId]);
    logActivity(orgId, (req as any).user?.id, 'jira_disconnected', 'Disconnected Jira integration');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[Jira] disconnect error');
    res.status(500).json({ error: 'Failed to disconnect Jira' });
  }
}

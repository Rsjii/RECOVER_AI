import { Request, Response } from 'express';
import { db } from '../../config/db';
import { logger } from '../../config/logger';
import { teamMappingService } from '../../services/teamMappingService';

export async function getMappings(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;

    const mappings = await db.query(
      `SELECT * FROM team_member_mappings WHERE org_id = $1 ORDER BY github_login`,
      [orgId]
    );

    res.json(mappings.rows);
  } catch (err) {
    logger.error({ err }, '[TeamMapping] getMappings error');
    res.status(500).json({ error: 'Failed to get mappings' });
  }
}

export async function confirmMapping(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    // Support both POST body (githubLogin) and route param (:id)
    const githubLogin = req.body?.githubLogin;
    const id = req.params['id'];

    if (githubLogin) {
      await db.query(
        `UPDATE team_member_mappings SET is_confirmed = true
         WHERE org_id = $1 AND github_login = $2`,
        [orgId, githubLogin]
      );
    } else if (id) {
      await db.query(
        `UPDATE team_member_mappings SET is_confirmed = true
         WHERE id = $1 AND org_id = $2`,
        [id, orgId]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[TeamMapping] confirm error');
    res.status(500).json({ error: 'Failed to confirm mapping' });
  }
}

export async function autoMapMembers(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    await teamMappingService.autoMapMembers(orgId);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[TeamMapping] autoMap error');
    res.status(500).json({ error: 'Failed to auto-map members' });
  }
}

export async function setManualMapping(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const { githubLogin, jiraAccountId } = req.body as { githubLogin: string; jiraAccountId: string };

    if (!githubLogin || !jiraAccountId) {
      return res.status(400).json({ error: 'githubLogin and jiraAccountId required' });
    }

    await teamMappingService.setManualMapping(orgId, githubLogin, jiraAccountId);

    // Mark team mapping step complete
    await db.query(
      `INSERT INTO onboarding_state (org_id, step_team_mapped) VALUES ($1, true)
       ON CONFLICT (org_id) DO UPDATE SET step_team_mapped = true, updated_at = NOW()`,
      [orgId]
    );

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[TeamMapping] setManual error');
    res.status(500).json({ error: 'Failed to set mapping' });
  }
}

export async function deleteMapping(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const { id } = req.params;

    await db.query(
      `DELETE FROM team_member_mappings WHERE id = $1 AND org_id = $2`,
      [id, orgId]
    );

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[TeamMapping] delete error');
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
}

export async function getGithubUsers(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;

    const users = await db.query(
      `SELECT u.github_username as login, u.email, u.avatar_url
       FROM users u
       JOIN team_members tm ON tm.user_id = u.id
       WHERE tm.org_id = $1
       ORDER BY u.github_username`,
      [orgId]
    );

    res.json({ users: users.rows });
  } catch (err) {
    logger.error({ err }, '[TeamMapping] getGithubUsers error');
    res.status(500).json({ error: 'Failed to get GitHub users' });
  }
}

export async function getJiraUsers(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.org_id;
    const { jiraService } = await import('../../services/jiraService');
    const users = await jiraService.getUsers(orgId);
    res.json(users);
  } catch (err) {
    logger.error({ err }, '[TeamMapping] getJiraUsers error');
    res.status(500).json({ error: 'Failed to get Jira users' });
  }
}

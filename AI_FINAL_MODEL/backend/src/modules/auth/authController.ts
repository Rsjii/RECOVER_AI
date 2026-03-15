import { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { db } from '../../config/db';
import { config, isDev } from '../../config/env';
import { logger } from '../../config/logger';
import { AuthRequest } from '../../types';

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   !isDev,
  sameSite: isDev ? ('lax' as const) : ('none' as const),
  maxAge:   30 * 24 * 60 * 60 * 1000,
};

export const githubLogin = (req: Request, res: Response) => {
  const redirectAfter = req.query['redirect'] as string | undefined;
  const state = redirectAfter
    ? Buffer.from(JSON.stringify({ redirect: redirectAfter })).toString('base64url')
    : undefined;

  const redirectUri = encodeURIComponent(`${config.apiUrl}/api/auth/github/callback`);
  // Minimal scopes — identity only. Repo access handled by GitHub App (org-level).
  let url = `https://github.com/login/oauth/authorize?client_id=${config.github.clientId}&scope=read:user,user:email&redirect_uri=${redirectUri}`;
  if (state) url += `&state=${encodeURIComponent(state)}`;
  res.redirect(url);
};

export const githubCallback = async (req: Request, res: Response) => {
  const { code, error, state } = req.query;

  if (error) {
    logger.warn({ error }, 'GitHub OAuth error');
    return res.redirect(`${config.frontendUrl}/login?error=${error}`);
  }
  if (!code) return res.redirect(`${config.frontendUrl}/login?error=no_code`);

  let redirectAfter: string | null = null;
  if (state) {
    try {
      const parsed = JSON.parse(Buffer.from(state as string, 'base64url').toString());
      if (typeof parsed.redirect === 'string' && parsed.redirect.startsWith('/')) {
        redirectAfter = parsed.redirect;
      }
    } catch { /* ignore */ }
  }

  try {
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      { client_id: config.github.clientId, client_secret: config.github.clientSecret, code },
      { headers: { Accept: 'application/json' } }
    );

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      logger.error('No access token from GitHub', { response: tokenRes.data });
      return res.redirect(`${config.frontendUrl}/login?error=no_token`);
    }

    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const ghUser = userRes.data;

    let email = ghUser.email;
    if (!email) {
      try {
        const emailRes = await axios.get('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        email = emailRes.data.find((e: any) => e.primary)?.email || null;
      } catch { /* ignore */ }
    }

    const result = await db.query(
      `INSERT INTO users (github_id, github_username, email, avatar_url, access_token)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (github_id) DO UPDATE SET
         github_username = EXCLUDED.github_username,
         email           = EXCLUDED.email,
         avatar_url      = EXCLUDED.avatar_url,
         access_token    = EXCLUDED.access_token
       RETURNING *`,
      [String(ghUser.id), ghUser.login, email, ghUser.avatar_url, accessToken]
    );

    const user  = result.rows[0];
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });

    res.cookie('cm_token', token, COOKIE_OPTS);
    const defaultRedirect = user.org_id ? '/dashboard' : '/setup';
    res.redirect(`${config.frontendUrl}${redirectAfter || defaultRedirect}`);
  } catch (err: any) {
    logger.error({ err, stack: err.stack }, 'GitHub OAuth callback error');
    res.redirect(`${config.frontendUrl}/login?error=oauth_failed`);
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('cm_token', { httpOnly: true, secure: !isDev, sameSite: isDev ? 'lax' : 'none' });
  res.json({ success: true });
};

export const getMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  if (req.orgId) {
    db.query(
      `UPDATE team_members SET last_seen_at = NOW() WHERE user_id = $1 AND org_id = $2`,
      [req.userId, req.orgId]
    ).catch(() => {});
  }

  let org = null;
  let tier = 'free';
  if (req.orgId) {
    const orgRes = await db.query(`SELECT * FROM organizations WHERE id = $1`, [req.orgId]);
    org = orgRes.rows[0] || null;
    const subRes = await db.query(`SELECT tier FROM subscriptions WHERE org_id = $1`, [req.orgId]);
    tier = subRes.rows[0]?.tier || 'free';
  }

  res.json({ user: req.user, org, tier });
};

export const githubAppCallback = async (req: Request, res: Response) => {
  const { installation_id, setup_action } = req.query;

  if (setup_action === 'deleted') {
    const token = req.cookies?.cm_token;
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret) as any;
        const userRes = await db.query(`SELECT org_id FROM users WHERE id = $1`, [decoded.userId]);
        const orgId   = userRes.rows[0]?.org_id;
        if (orgId) {
          await db.query(
            `UPDATE organizations SET github_app_installation_id = NULL WHERE id = $1`,
            [orgId]
          );
        }
      } catch { /* ignore */ }
    }
    return res.redirect(`${config.frontendUrl}/admin/settings?tab=integrations&app=uninstalled`);
  }

  if (!installation_id) {
    return res.redirect(`${config.frontendUrl}/admin/settings?tab=integrations&app=error`);
  }

  const token = req.cookies?.cm_token;
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;
      const userRes = await db.query(`SELECT org_id FROM users WHERE id = $1`, [decoded.userId]);
      const orgId   = userRes.rows[0]?.org_id;
      if (orgId) {
        await db.query(
          `UPDATE organizations SET github_app_installation_id = $1 WHERE id = $2`,
          [Number(installation_id), orgId]
        );
        logger.info({ installation_id, orgId }, 'GitHub App installed');
      }
    } catch (e) {
      logger.error({ err: e }, 'Failed to store GitHub App installation');
    }
  }

  return res.redirect(`${config.frontendUrl}/admin/settings?tab=integrations&app=installed`);
};

export const githubAppInstall = (req: Request, res: Response) => {
  const appSlug = config.githubApp.appSlug;
  if (!appSlug) return res.status(500).json({ error: 'GitHub App not configured (GITHUB_APP_SLUG missing)' });
  res.redirect(`https://github.com/apps/${appSlug}/installations/new`);
};

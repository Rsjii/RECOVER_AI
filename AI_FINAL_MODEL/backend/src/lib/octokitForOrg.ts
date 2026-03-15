import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { db } from '../config/db';
import { config } from '../config/env';

// Cache installation tokens: orgId → { token, expiresAt }
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function octokitForOrg(orgId: string): Promise<Octokit> {
  // Return cached token if still valid (with 5 min buffer)
  const cached = tokenCache.get(orgId);
  if (cached && Date.now() < cached.expiresAt) {
    return new Octokit({ auth: cached.token });
  }

  const r = await db.query(
    `SELECT github_app_installation_id FROM organizations WHERE id = $1`,
    [orgId]
  );
  const installationId = r.rows[0]?.github_app_installation_id;
  if (!installationId) {
    throw new Error('GitHub App not installed for this organization. Go to Settings → Integrations to connect.');
  }

  if (!config.githubApp.appId || !config.githubApp.privateKeyB64) {
    throw new Error('GitHub App credentials not configured on server (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY_BASE64)');
  }

  const privateKey = Buffer.from(config.githubApp.privateKeyB64, 'base64').toString('utf8');

  const auth = createAppAuth({
    appId:          Number(config.githubApp.appId),
    privateKey,
    installationId: Number(installationId),
  });

  const result = await auth({ type: 'installation' });

  // Cache for 55 minutes (GitHub installation tokens expire in 60 min)
  tokenCache.set(orgId, {
    token:     result.token,
    expiresAt: new Date(result.expiresAt).getTime() - 5 * 60 * 1000,
  });

  return new Octokit({ auth: result.token });
}

/**
 * Returns a raw GitHub access token for the org.
 * Prefers GitHub App installation token; falls back to admin's personal token.
 */
export async function getOrgToken(orgId: string): Promise<string> {
  // Check cache first
  const cached = tokenCache.get(orgId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  // Try GitHub App
  try {
    const r = await db.query(
      `SELECT github_app_installation_id FROM organizations WHERE id = $1`,
      [orgId]
    );
    const installationId = r.rows[0]?.github_app_installation_id;
    if (installationId && config.githubApp.appId && config.githubApp.privateKeyB64) {
      const privateKey = Buffer.from(config.githubApp.privateKeyB64, 'base64').toString('utf8');
      const auth = createAppAuth({
        appId:          Number(config.githubApp.appId),
        privateKey,
        installationId: Number(installationId),
      });
      const result = await auth({ type: 'installation' });
      tokenCache.set(orgId, {
        token:     result.token,
        expiresAt: new Date(result.expiresAt).getTime() - 5 * 60 * 1000,
      });
      return result.token;
    }
  } catch { /* fall through to personal token */ }

  // Fall back to admin's personal access token
  const tokenRes = await db.query(
    `SELECT u.access_token FROM users u
     JOIN team_members tm ON tm.user_id = u.id
     WHERE tm.org_id = $1 AND tm.role = 'admin' AND u.access_token IS NOT NULL
     LIMIT 1`,
    [orgId]
  );
  if (tokenRes.rows.length === 0) throw new Error('No access token available for org');
  return tokenRes.rows[0].access_token;
}

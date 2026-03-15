import axios from 'axios';
import crypto from 'crypto';
import { db } from '../config/db';
import { logger } from '../config/logger';
import { config } from '../config/env';
import { encrypt, decrypt } from '../lib/encryption';

const ATLASSIAN_AUTH_URL  = 'https://auth.atlassian.com/authorize';
const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const SCOPES = 'read:jira-work read:jira-user offline_access';

// In-memory PKCE state store — keyed by random state string
// Entries expire after 10 minutes; cleanup runs every 5 minutes
const stateStore = new Map<string, { orgId: string; codeVerifier: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of stateStore) {
    if (now > val.expiresAt) stateStore.delete(key);
  }
}, 5 * 60 * 1000).unref(); // unref so it doesn't block process exit

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export const jiraOAuthService = {
  /** Step 1: Build the Atlassian OAuth 2.0 authorization URL with PKCE */
  getAuthorizationUrl(orgId: string): string {
    const state         = crypto.randomBytes(16).toString('hex');
    const codeVerifier  = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Store state → orgId + verifier (expires in 10 min)
    stateStore.set(state, { orgId, codeVerifier, expiresAt: Date.now() + 10 * 60 * 1000 });

    const params = new URLSearchParams({
      audience:               'api.atlassian.com',
      client_id:              config.jira.clientId,
      scope:                  SCOPES,
      redirect_uri:           config.jira.redirectUri,
      state,
      response_type:          'code',
      prompt:                 'consent',
      code_challenge:         codeChallenge,
      code_challenge_method:  'S256',
    });

    return `${ATLASSIAN_AUTH_URL}?${params.toString()}`;
  },

  /** Step 2: Exchange authorization code for tokens, store encrypted in DB */
  async exchangeCodeForTokens(code: string, state: string): Promise<void> {
    const stored = stateStore.get(state);
    if (!stored) throw new Error('Invalid or expired OAuth state');
    if (Date.now() > stored.expiresAt) {
      stateStore.delete(state);
      throw new Error('OAuth state expired');
    }
    stateStore.delete(state);

    const { orgId, codeVerifier } = stored;

    const response = await axios.post(ATLASSIAN_TOKEN_URL, {
      grant_type:    'authorization_code',
      client_id:     config.jira.clientId,
      client_secret: config.jira.clientSecret,
      code,
      redirect_uri:  config.jira.redirectUri,
      code_verifier: codeVerifier,
    }, { headers: { 'Content-Type': 'application/json' } });

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + (expires_in - 60) * 1000); // 60s buffer

    await db.query(
      `INSERT INTO jira_connections (org_id, access_token_enc, refresh_token_enc, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (org_id) DO UPDATE SET
         access_token_enc = $2, refresh_token_enc = $3, expires_at = $4, updated_at = NOW()`,
      [orgId, encrypt(access_token), encrypt(refresh_token), expiresAt.toISOString()]
    );

    logger.info({ orgId }, '[JiraOAuth] Tokens stored');
  },

  /** Get a valid access token for an org — auto-refreshes if near expiry */
  async getValidToken(orgId: string): Promise<string> {
    const row = await db.query(
      `SELECT access_token_enc, refresh_token_enc, expires_at FROM jira_connections WHERE org_id = $1`,
      [orgId]
    );
    if (!row.rows[0]) throw new Error(`No Jira connection for org ${orgId}`);

    const { access_token_enc, refresh_token_enc, expires_at } = row.rows[0];
    const expiresAt = new Date(expires_at).getTime();

    // Refresh if within 5 minutes of expiry
    if (Date.now() >= expiresAt - 5 * 60 * 1000) {
      return jiraOAuthService.refreshAccessToken(orgId, decrypt(refresh_token_enc));
    }

    return decrypt(access_token_enc);
  },

  /** Refresh the access token using the stored refresh token */
  async refreshAccessToken(orgId: string, refreshToken: string): Promise<string> {
    const response = await axios.post(ATLASSIAN_TOKEN_URL, {
      grant_type:    'refresh_token',
      client_id:     config.jira.clientId,
      client_secret: config.jira.clientSecret,
      refresh_token: refreshToken,
    }, { headers: { 'Content-Type': 'application/json' } });

    const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + (expires_in - 60) * 1000);

    await db.query(
      `UPDATE jira_connections SET
         access_token_enc = $1,
         refresh_token_enc = $2,
         expires_at = $3,
         updated_at = NOW()
       WHERE org_id = $4`,
      [encrypt(access_token), encrypt(newRefreshToken || refreshToken), expiresAt.toISOString(), orgId]
    );

    logger.info({ orgId }, '[JiraOAuth] Token refreshed');
    return access_token;
  },
};

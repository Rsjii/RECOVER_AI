import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const rootEnvPath    = path.resolve(__dirname, '../../../.env');
const backendEnvPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(rootEnvPath))         dotenv.config({ path: rootEnvPath });
else if (fs.existsSync(backendEnvPath)) dotenv.config({ path: backendEnvPath });
else                                     dotenv.config();

const NODE_ENV = process.env['NODE_ENV'] || 'development';
export const isDev  = NODE_ENV === 'development';
export const isProd = NODE_ENV === 'production';

const REQUIRED_ALWAYS  = ['DATABASE_URL', 'JWT_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'ANTHROPIC_API_KEY', 'ENCRYPTION_KEY'];
const REQUIRED_IN_PROD = ['GITHUB_WEBHOOK_SECRET', 'RESEND_API_KEY', 'FRONTEND_URL', 'API_URL', 'JIRA_CLIENT_ID', 'JIRA_CLIENT_SECRET'];

function validateEnv() {
  const missing: string[] = [];
  for (const key of REQUIRED_ALWAYS) if (!process.env[key]) missing.push(key);
  if (isProd) {
    for (const key of REQUIRED_IN_PROD) if (!process.env[key]) missing.push(key);
    if (process.env['JWT_SECRET'] === 'change-me-in-production') missing.push('JWT_SECRET (still has insecure default)');
  }
  if (missing.length) {
    const msg = `[Config] Missing required env vars:\n  ${missing.join('\n  ')}`;
    if (isProd) { console.error(msg); process.exit(1); } else console.warn(msg);
  }
}
validateEnv();

export const config = {
  databaseUrl:   process.env['DATABASE_URL'] as string,
  redisUrl:      process.env['REDIS_URL'] || 'redis://localhost:6379',
  openaiApiKey:  process.env['OPENAI_API_KEY'],
  anthropicApiKey: process.env['ANTHROPIC_API_KEY'] as string,

  github: {
    clientId:      process.env['GITHUB_CLIENT_ID'] as string,
    clientSecret:  process.env['GITHUB_CLIENT_SECRET'] as string,
    webhookSecret: process.env['GITHUB_WEBHOOK_SECRET'] as string,
  },

  // GitHub App (separate from OAuth App — used for repo access)
  githubApp: {
    appId:          process.env['GITHUB_APP_ID'] || '',
    appSlug:        process.env['GITHUB_APP_SLUG'] || '',           // e.g. "codebase-memory"
    privateKeyB64:  process.env['GITHUB_APP_PRIVATE_KEY_BASE64'] || '',
    clientId:       process.env['GITHUB_APP_CLIENT_ID'] || '',      // optional: if using App for OAuth too
    clientSecret:   process.env['GITHUB_APP_CLIENT_SECRET'] || '',
  },

  lemonSqueezy: {
    apiKey:        process.env['LEMONSQUEEZY_API_KEY'] as string,
    storeId:       process.env['LEMONSQUEEZY_STORE_ID'] as string,
    webhookSecret: process.env['LEMONSQUEEZY_WEBHOOK_SECRET'] as string,
  },

  resendApiKey: process.env['RESEND_API_KEY'] as string,
  emailFrom:    process.env['EMAIL_FROM'] || 'EngineeringOS <brief@resend.dev>',
  jwtSecret:    process.env['JWT_SECRET'] || 'change-me-in-production',
  frontendUrl:  process.env['FRONTEND_URL'] || 'http://localhost:5173',
  apiUrl:       process.env['API_URL'] || 'http://localhost:3000',
  port:         Number(process.env['PORT']) || 3000,
  nodeEnv:      NODE_ENV,
  adminSecret:  process.env['ADMIN_SECRET'] || 'change-me-in-production',

  // ── EngineeringOS Phase 1 ────────────────────────────────────────────────
  jira: {
    clientId:     process.env['JIRA_CLIENT_ID'] || '',
    clientSecret: process.env['JIRA_CLIENT_SECRET'] || '',
    redirectUri:  process.env['JIRA_REDIRECT_URI'] || 'http://localhost:3000/api/jira/callback',
  },
  // AES-256-GCM key for encrypting Jira OAuth tokens at rest (32 bytes = 64 hex chars)
  encryptionKey: process.env['ENCRYPTION_KEY'] || '',
  // Feature flag: set PHASE2_ENABLED=true to re-enable flagged Phase 2 routes/services
  phase2Enabled: process.env['PHASE2_ENABLED'] === 'true',
};

export default config;

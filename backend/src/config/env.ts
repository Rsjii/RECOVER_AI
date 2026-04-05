// Fail-closed NODE_ENV validation.
// Prevents 'development' defaults (including test OTP '123456') from leaking to prod
// if the env var is missing/misspelled during deployment.
const rawNodeEnv = process.env.NODE_ENV;
if (!rawNodeEnv || !['production', 'staging', 'development'].includes(rawNodeEnv)) {
  throw new Error(
    `NODE_ENV must be explicitly set to 'production', 'staging', or 'development'. Got: '${rawNodeEnv || '<unset>'}'`
  );
}

export const config = {
  nodeEnv: rawNodeEnv,
  isProduction: rawNodeEnv === 'production',
  port: parseInt(process.env.PORT || '3000'),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,
  adminSecret: process.env.ADMIN_SECRET,
  frontendUrl: process.env.FRONTEND_URL,
  stripe: {
    apiKey: process.env.STRIPE_API_KEY,
    clientId: process.env.STRIPE_CLIENT_ID,
    clientSecret: process.env.STRIPE_CLIENT_SECRET,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  quickbooks: {
    clientId: process.env.QB_CLIENT_ID,
    clientSecret: process.env.QB_CLIENT_SECRET,
    environment: (process.env.QB_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@recoverai.com',
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@recoverai.com',
    fromName: process.env.SENDGRID_FROM_NAME || 'RecoverAI',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-1',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL,
  },
  admin: {
    // Comma-separated list of admin emails (strict whitelist)
    // Default: only company founders/team leads should have access
    emails: (process.env.ADMIN_EMAILS || 'admin@company.com,founder@company.com').split(',').map(e => e.trim().toLowerCase()),
  },
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
};

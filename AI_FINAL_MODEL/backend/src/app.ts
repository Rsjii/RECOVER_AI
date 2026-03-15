import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import { logger } from './config/logger';
import { errorHandlerMiddleware } from './middleware/errorHandler';
import { authLimiter, generalLimiter } from './middleware/rateLimiter';
// searchLimiter — PHASE2_DISABLED (re-enable with: import { searchLimiter } from './middleware/rateLimiter')

// ── Phase 1: Core routes (always active) ─────────────────────────────────────
import authRoutes    from './modules/auth/authRoutes';
import repoRoutes    from './modules/repos/repoRoutes';
import webhookRoutes from './modules/webhooks/webhookRoutes';
import teamRoutes    from './modules/teams/teamRoutes';
import billingRoutes from './modules/billing/billingRoutes';
import adminRoutes   from './modules/admin/adminRoutes';

// ── EngineeringOS Phase 1: New EOS routes ────────────────────────────────────
import jiraRoutes        from './modules/jira/jiraRoutes';
import briefRoutes       from './modules/briefs/briefRoutes';
import onboardingRoutes  from './modules/onboarding/onboardingRoutes';
import teamMappingRoutes from './modules/team-mapping/teamMappingRoutes';
import slackRoutes       from './modules/slack/slackRoutes';
import eosTeamRoutes     from './modules/eos-team/eosTeamRoutes';

// ── EngineeringOS Phase 1.5: Analytics + Reports ──────────────────────────────
import analyticsRoutes from './modules/analytics/analyticsRoutes';
import reportsRoutes   from './modules/reports/reportsRoutes';

// ── PHASE2_DISABLED imports ───────────────────────────────────────────────────
// Uncomment + set PHASE2_ENABLED=true to re-enable Phase 2 features:
// import prRoutes      from './modules/prs/prRoutes';
// import searchRoutes  from './modules/search/searchRoutes';
// import apiKeyRoutes  from './modules/api-keys/apiKeysRoutes';

const app = express();

app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for bull-board UI
app.use(cors({ origin: config.frontendUrl, credentials: true }));

// Raw body must come before JSON parser
app.use('/webhooks',            express.raw({ type: 'application/json' }));
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
// Slack action payloads come as URL-encoded form data
app.use('/webhooks/slack-actions', express.urlencoded({ extended: true }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging: only slow (>2s) or error responses
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (res.statusCode >= 400 || ms > 2000) {
      logger.info({ method: req.method, path: req.path, status: res.statusCode, ms }, '[HTTP]');
    }
  });
  next();
});

app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── BullMQ Queue Dashboard ────────────────────────────────────────────────────
// Access at /queues — protected by simple token check (ADMIN_SECRET env var)
// Shows all jobs: pending, active, completed, failed — with retry buttons
async function setupBullBoard() {
  try {
    const { createBullBoard }  = await import('@bull-board/api');
    const { BullMQAdapter }    = await import('@bull-board/api/bullMQAdapter');
    const { ExpressAdapter }   = await import('@bull-board/express');
    const { indexingQueue, analysisQueue, reindexQueue } = await import('./jobs/queue');

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/queues');

    createBullBoard({
      queues: [
        new BullMQAdapter(indexingQueue),
        new BullMQAdapter(analysisQueue),
        new BullMQAdapter(reindexQueue),
      ],
      serverAdapter,
    });

    // Simple protection: require ?secret=ADMIN_SECRET in URL
    app.use('/queues', (req, _res, next) => {
      const secret = req.query['secret'] || req.headers['x-queue-secret'];
      if (config.adminSecret && secret !== config.adminSecret) {
        _res.status(401).send('Unauthorized. Add ?secret=YOUR_ADMIN_SECRET to URL.');
        return;
      }
      next();
    }, serverAdapter.getRouter());

    logger.info('[App] BullMQ dashboard available at /queues');
  } catch (e: any) {
    // Non-fatal: if @bull-board packages not installed, skip silently
    logger.warn(`[App] BullMQ dashboard not available (run: npm install @bull-board/api @bull-board/express): ${e.message}`);
  }
}

setupBullBoard();

// ── Route registration ────────────────────────────────────────────────────────

// Phase 1: Core
app.use('/api/auth',     authLimiter,    authRoutes);
app.use('/api/repos',    generalLimiter, repoRoutes);
app.use('/webhooks',                     webhookRoutes);
app.use('/api/team',     generalLimiter, teamRoutes);
app.use('/api/billing',  generalLimiter, billingRoutes);
app.use('/api/admin',    generalLimiter, adminRoutes);

// Phase 1: EngineeringOS
app.use('/api/jira',         generalLimiter, jiraRoutes);
app.use('/api/briefs',       generalLimiter, briefRoutes);
app.use('/api/onboarding',   generalLimiter, onboardingRoutes);
app.use('/api/team-mapping', generalLimiter, teamMappingRoutes);
app.use('/api/slack',        generalLimiter, slackRoutes);
app.use('/api/eos',          generalLimiter, eosTeamRoutes);
app.use('/api/analytics',   generalLimiter, analyticsRoutes);
app.use('/api/reports',     generalLimiter, reportsRoutes);

// PHASE2_DISABLED: remove comments below + set PHASE2_ENABLED=true to re-enable
// app.use('/api/prs',      generalLimiter, prRoutes);
// app.use('/api/search',   searchLimiter,  searchRoutes);
// app.use('/api/api-keys', generalLimiter, apiKeyRoutes);

app.use(errorHandlerMiddleware);

export default app;

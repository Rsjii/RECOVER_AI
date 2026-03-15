import http from 'http';
import app from './app';
import { config } from './config/env';
import { logger } from './config/logger';
import { db } from './config/db';
import { startWorkers } from './jobs/queue';
import fs from 'fs';
import path from 'path';

process.on('unhandledRejection', (reason: any) => {
  const ignorable = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED'];
  if (ignorable.includes(reason?.code) || reason?.syscall === 'read') return;
  logger.error({ reason }, 'Unhandled rejection');
});

process.on('uncaughtException', (err: any) => {
  const ignorable = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNABORTED'];
  if (ignorable.includes(err.code)) return;
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});

// Tables added after initial launch — safe to run on every startup (IF NOT EXISTS)
// For ALTER TABLE migrations, set checkColumn to the first new column added.
const INCREMENTAL_MIGRATIONS: { name: string; sql: string; checkColumn?: string }[] = [
  {
    name: 'join_links',
    sql: `
      CREATE TABLE IF NOT EXISTS join_links (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
        token       VARCHAR UNIQUE NOT NULL,
        role        VARCHAR CHECK (role IN ('admin','reviewer','developer')) DEFAULT 'developer',
        created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
        is_active   BOOLEAN NOT NULL DEFAULT true,
        uses_count  INT NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS join_links_org_active_idx
        ON join_links (org_id, is_active, expires_at);
    `,
  },
  // ── EngineeringOS Phase 1 tables ─────────────────────────────────────────
  {
    name: 'jira_connections',
    sql: `
      CREATE TABLE IF NOT EXISTS jira_connections (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
        site_id           VARCHAR, site_url VARCHAR, cloud_id VARCHAR,
        access_token_enc  TEXT, refresh_token_enc TEXT, expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_jira_connections_org ON jira_connections (org_id);
    `,
  },
  {
    name: 'jira_projects',
    sql: `
      CREATE TABLE IF NOT EXISTS jira_projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        jira_project_id VARCHAR NOT NULL, project_key VARCHAR NOT NULL,
        project_name VARCHAR NOT NULL, is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, project_key)
      );
      CREATE INDEX IF NOT EXISTS idx_jira_projects_org ON jira_projects (org_id, is_active);
    `,
  },
  {
    name: 'jira_sprints',
    sql: `
      CREATE TABLE IF NOT EXISTS jira_sprints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        jira_sprint_id VARCHAR NOT NULL, project_key VARCHAR NOT NULL, board_id VARCHAR,
        name VARCHAR NOT NULL,
        state VARCHAR CHECK (state IN ('active','closed','future')) DEFAULT 'future',
        start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, goal TEXT,
        total_tickets INT DEFAULT 0, completed_tickets INT DEFAULT 0, velocity_points INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, jira_sprint_id)
      );
      CREATE INDEX IF NOT EXISTS idx_jira_sprints_org_state ON jira_sprints (org_id, state, end_date);
    `,
  },
  {
    name: 'jira_tickets',
    sql: `
      CREATE TABLE IF NOT EXISTS jira_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        jira_ticket_id VARCHAR NOT NULL, project_key VARCHAR NOT NULL,
        summary TEXT NOT NULL, description TEXT,
        assignee_jira_id VARCHAR, reporter_jira_id VARCHAR,
        status VARCHAR, priority VARCHAR, issue_type VARCHAR,
        sprint_id VARCHAR, epic_id VARCHAR, story_points NUMERIC(5,1),
        created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, resolved_at TIMESTAMPTZ,
        linked_github_prs JSONB DEFAULT '[]', indexed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, jira_ticket_id)
      );
      CREATE INDEX IF NOT EXISTS idx_jira_tickets_org ON jira_tickets (org_id, status, sprint_id);
      CREATE INDEX IF NOT EXISTS idx_jira_tickets_assignee ON jira_tickets (org_id, assignee_jira_id, status);
    `,
  },
  {
    name: 'github_commits_eos',
    sql: `
      CREATE TABLE IF NOT EXISTS github_commits_eos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        repo_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
        sha VARCHAR NOT NULL, author_github_id VARCHAR, author_login VARCHAR,
        author_name VARCHAR, author_email VARCHAR, message TEXT,
        files_changed JSONB DEFAULT '[]', insertions INT DEFAULT 0, deletions INT DEFAULT 0,
        timestamp TIMESTAMPTZ, branch VARCHAR, linked_jira_keys TEXT[] DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, sha)
      );
      CREATE INDEX IF NOT EXISTS idx_commits_eos_org_author ON github_commits_eos (org_id, author_github_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_commits_eos_repo ON github_commits_eos (repo_id, timestamp DESC);
    `,
  },
  {
    name: 'github_prs_eos',
    sql: `
      CREATE TABLE IF NOT EXISTS github_prs_eos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        repo_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
        pr_number INT NOT NULL, title VARCHAR NOT NULL, description TEXT,
        author_github_id VARCHAR, author_login VARCHAR, state VARCHAR DEFAULT 'open',
        created_at TIMESTAMPTZ, merged_at TIMESTAMPTZ, closed_at TIMESTAMPTZ,
        merge_duration_hours FLOAT, files_changed JSONB DEFAULT '[]',
        linked_jira_tickets TEXT[] DEFAULT '{}',
        review_comments_count INT DEFAULT 0, commits_count INT DEFAULT 0,
        has_reviewer BOOLEAN DEFAULT false, reviewer_ids TEXT[] DEFAULT '{}',
        head_branch VARCHAR, indexed_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, repo_id, pr_number)
      );
      CREATE INDEX IF NOT EXISTS idx_prs_eos_org_state ON github_prs_eos (org_id, state, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_prs_eos_author ON github_prs_eos (org_id, author_github_id, state);
    `,
  },
  {
    name: 'github_pr_reviews_eos',
    sql: `
      CREATE TABLE IF NOT EXISTS github_pr_reviews_eos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pr_id UUID REFERENCES github_prs_eos(id) ON DELETE CASCADE,
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        reviewer_github_id VARCHAR NOT NULL, reviewer_login VARCHAR,
        state VARCHAR CHECK (state IN ('approved','changes_requested','pending','commented','dismissed')) DEFAULT 'pending',
        submitted_at TIMESTAMPTZ, comments_count INT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pr_reviews_eos_pr ON github_pr_reviews_eos (pr_id, submitted_at DESC);
      CREATE INDEX IF NOT EXISTS idx_pr_reviews_eos_reviewer ON github_pr_reviews_eos (org_id, reviewer_github_id, submitted_at DESC);
    `,
  },
  {
    name: 'github_files_touched',
    sql: `
      CREATE TABLE IF NOT EXISTS github_files_touched (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        repo_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
        file_path VARCHAR NOT NULL, author_github_id VARCHAR NOT NULL,
        author_login VARCHAR, touch_count INT DEFAULT 1,
        last_touched_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, repo_id, file_path, author_github_id)
      );
      CREATE INDEX IF NOT EXISTS idx_files_touched_file ON github_files_touched (repo_id, file_path, touch_count DESC);
      CREATE INDEX IF NOT EXISTS idx_files_touched_author ON github_files_touched (org_id, author_github_id);
    `,
  },
  {
    name: 'team_member_mappings',
    sql: `
      CREATE TABLE IF NOT EXISTS team_member_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        github_login VARCHAR, github_id VARCHAR, github_email VARCHAR,
        jira_account_id VARCHAR, jira_display_name VARCHAR, jira_email VARCHAR,
        is_confirmed BOOLEAN DEFAULT false, mapped_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, github_login), UNIQUE(org_id, jira_account_id)
      );
      CREATE INDEX IF NOT EXISTS idx_team_mappings_org ON team_member_mappings (org_id);
    `,
  },
  {
    name: 'daily_briefs',
    sql: `
      CREATE TABLE IF NOT EXISTS daily_briefs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        brief_date DATE NOT NULL, content_slack JSONB, content_email TEXT, content_raw TEXT,
        pattern_count INT DEFAULT 0, severity_high INT DEFAULT 0, severity_medium INT DEFAULT 0,
        sent_at TIMESTAMPTZ, sent_via VARCHAR, created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, brief_date)
      );
      CREATE INDEX IF NOT EXISTS idx_daily_briefs_org ON daily_briefs (org_id, brief_date DESC);
    `,
  },
  {
    name: 'brief_items',
    sql: `
      CREATE TABLE IF NOT EXISTS brief_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brief_id UUID REFERENCES daily_briefs(id) ON DELETE CASCADE,
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        pattern_type VARCHAR NOT NULL CHECK (pattern_type IN ('stale_pr','silent_engineer','sprint_slip','no_reviewer')),
        severity VARCHAR NOT NULL CHECK (severity IN ('HIGH','MEDIUM','LOW')),
        title TEXT NOT NULL, description TEXT, action_suggestion TEXT,
        engineer_github_id VARCHAR,
        pr_id UUID REFERENCES github_prs_eos(id) ON DELETE SET NULL,
        ticket_id UUID REFERENCES jira_tickets(id) ON DELETE SET NULL,
        is_acknowledged BOOLEAN DEFAULT false, is_dismissed BOOLEAN DEFAULT false,
        snoozed_until TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_brief_items_brief ON brief_items (brief_id, severity);
      CREATE INDEX IF NOT EXISTS idx_brief_items_org ON brief_items (org_id, created_at DESC);
    `,
  },
  {
    name: 'slack_connections',
    sql: `
      CREATE TABLE IF NOT EXISTS slack_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
        webhook_url TEXT NOT NULL, channel_name VARCHAR, is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  {
    name: 'onboarding_state',
    sql: `
      CREATE TABLE IF NOT EXISTS onboarding_state (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
        step_github BOOLEAN DEFAULT false, step_jira BOOLEAN DEFAULT false,
        step_team_mapped BOOLEAN DEFAULT false, step_configured BOOLEAN DEFAULT false,
        step_previewed BOOLEAN DEFAULT false, completed BOOLEAN DEFAULT false,
        index_started_at TIMESTAMPTZ, index_progress INT DEFAULT 0, index_message TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  {
    name: 'brief_config',
    sql: `
      CREATE TABLE IF NOT EXISTS brief_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
        delivery_time VARCHAR DEFAULT '08:00', delivery_timezone VARCHAR DEFAULT 'UTC',
        slack_enabled BOOLEAN DEFAULT true, email_enabled BOOLEAN DEFAULT true,
        stale_pr_days INT DEFAULT 3, sprint_risk_threshold INT DEFAULT 40,
        silent_engineer_days INT DEFAULT 3,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  // ── EngineeringOS Phase 1.5 additions ────────────────────────────────────────
  {
    name: 'weekly_reports',
    sql: `
      CREATE TABLE IF NOT EXISTS weekly_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        content_raw TEXT,
        content_slack JSONB,
        content_email TEXT,
        metrics JSONB DEFAULT '{}',
        pattern_summary JSONB DEFAULT '[]',
        sent_at TIMESTAMPTZ,
        sent_via TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(org_id, week_start)
      );
      CREATE INDEX IF NOT EXISTS idx_weekly_reports_org_week
        ON weekly_reports(org_id, week_start DESC);
    `,
  },
  {
    name: 'brief_config_weekly_cols',
    checkColumn: 'weekly_report_enabled',
    sql: `
      ALTER TABLE brief_config
        ADD COLUMN IF NOT EXISTS weekly_report_enabled BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS weekly_report_day TEXT DEFAULT 'friday',
        ADD COLUMN IF NOT EXISTS weekly_report_time TEXT DEFAULT '17:00';
      CREATE INDEX IF NOT EXISTS idx_jira_sprints_org_active
        ON jira_sprints(org_id, state) WHERE state = 'active';
      CREATE INDEX IF NOT EXISTS idx_github_prs_eos_merged
        ON github_prs_eos(org_id, merged_at DESC) WHERE merged_at IS NOT NULL;
    `,
  },
];

async function runMigrations() {
  const check = await db.query(`SELECT to_regclass('public.users') as exists`);
  if (!check.rows[0].exists) {
    logger.info('[DB] Tables not found — applying schema...');
    const schemaPath = path.resolve(__dirname, '../schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(sql);
    logger.info('[DB] Schema applied successfully');
    // Fall through — still run INCREMENTAL_MIGRATIONS so ALTER TABLE migrations apply
  }

  // Run all incremental migrations — each is idempotent (IF NOT EXISTS / IF column check)
  for (const m of INCREMENTAL_MIGRATIONS) {
    try {
      if (m.checkColumn) {
        // ALTER TABLE migration — check column existence first
        const colCheck = await db.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
          [m.name.replace(/_cols$/, ''), m.checkColumn]
        );
        if (colCheck.rows.length === 0) {
          logger.info(`[DB] Applying migration: ${m.name}`);
          await db.query(m.sql);
          logger.info(`[DB] Migration ${m.name} applied`);
        }
      } else {
        // CREATE TABLE migration — SQL has IF NOT EXISTS, always safe to run
        await db.query(m.sql);
      }
    } catch (err: any) {
      // Log but don't crash — a failed optional migration should not block startup
      logger.warn({ err: err.message, migration: m.name }, '[DB] Migration warning (non-fatal)');
    }
  }
}

async function main() {
  try {
    await db.query('SELECT 1');
    logger.info('[Server] DB connection ok');

    await runMigrations();

    const server = http.createServer(app);

    server.on('error', (err: any) => {
      if (err.code !== 'ECONNRESET') logger.error({ err }, '[Server] HTTP error');
    });
    server.on('connection', (socket) => {
      socket.on('error', (err: any) => {
        if (err.code !== 'ECONNRESET') logger.error({ err }, '[Server] Socket error');
      });
    });

    server.listen(config.port, () => {
      logger.info(`[Server] Running on port ${config.port} (${config.nodeEnv})`);
    });

    // Start workers after server is listening — Redis issues won't block HTTP
    startWorkers()
      .then(() => import('./jobs/eosQueue'))
      .then(({ startEosWorkers }) => startEosWorkers())
      .then(() => logger.info('[Server] Workers started'))
      .catch(err => logger.error({ err }, '[Server] Worker startup error (non-fatal)'));

    // Graceful shutdown: stop accepting connections, drain in-flight, close DB
    const shutdown = async (signal: string) => {
      logger.info(`[Server] ${signal} received — shutting down gracefully`);
      server.close(async () => {
        logger.info('[Server] HTTP server closed');
        try {
          await db.close();
          logger.info('[Server] DB pool closed');
        } catch (e) {
          logger.error({ err: e }, '[Server] Error closing DB pool');
        }
        process.exit(0);
      });
      // Force-exit if graceful shutdown takes too long
      setTimeout(() => {
        logger.error('[Server] Graceful shutdown timed out — forcing exit');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    logger.error({ err }, '[Server] Failed to start');
    process.exit(1);
  }
}

main();

-- Complete database schema for Codebase Memory
-- This file initializes all tables when the database is first created

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Organizations
CREATE TABLE organizations (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_org_id                 VARCHAR UNIQUE,
  github_org_name               VARCHAR NOT NULL,
  created_by                    UUID,
  created_at                    TIMESTAMPTZ DEFAULT NOW(),
  billing_email                VARCHAR,
  timezone                      VARCHAR DEFAULT 'UTC',
  logo_url                      VARCHAR,
  email_notifications_enabled   BOOLEAN DEFAULT true,
  webhook_endpoints             JSONB DEFAULT '[]',
  slack_workspace_id            VARCHAR,
  slack_channel_id              VARCHAR,
  notify_on_critical            BOOLEAN NOT NULL DEFAULT true,
  notify_on_high                BOOLEAN NOT NULL DEFAULT false,
  notify_recipients             VARCHAR(50) NOT NULL DEFAULT 'admins',
  github_app_installation_id    BIGINT
);

-- Users
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id       VARCHAR UNIQUE NOT NULL,
  github_username VARCHAR NOT NULL,
  email           VARCHAR,
  avatar_url      VARCHAR,
  access_token    TEXT,
  org_id          UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Link organizations.created_by to users
ALTER TABLE organizations ADD CONSTRAINT fk_created_by
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Team Members
CREATE TABLE team_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role       VARCHAR CHECK (role IN ('admin','reviewer','developer')) DEFAULT 'developer',
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  UNIQUE(user_id, org_id)
);

-- Invites
CREATE TABLE invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email       VARCHAR NOT NULL,
  token       VARCHAR UNIQUE NOT NULL,
  role        VARCHAR DEFAULT 'developer',
  invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Repositories
CREATE TABLE repositories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  github_repo_id    VARCHAR NOT NULL,
  full_name         VARCHAR NOT NULL,
  default_branch    VARCHAR DEFAULT 'main',
  webhook_id        VARCHAR,
  webhook_secret    VARCHAR,
  status            VARCHAR DEFAULT 'pending',
  indexing_progress INT DEFAULT 0,
  indexed_at        TIMESTAMPTZ,
  total_chunks      INT DEFAULT 0,
  error_message     TEXT,
  historical_prs_count INT DEFAULT 0,
  git_stats_indexed_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, github_repo_id)
);

-- Code Chunks (with vector embeddings)
CREATE TABLE code_chunks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id    UUID REFERENCES repositories(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL,
  file_path  VARCHAR NOT NULL,
  start_line INT,
  end_line   INT,
  chunk_type VARCHAR,
  name       VARCHAR,
  content    TEXT,
  language   VARCHAR,
  embedding  vector(1536),
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity index for code chunks
CREATE INDEX ON code_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON code_chunks (repo_id, file_path);

-- File Dependencies
CREATE TABLE file_dependencies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id       UUID REFERENCES repositories(id) ON DELETE CASCADE,
  source_file   VARCHAR NOT NULL,
  target_file   VARCHAR NOT NULL,
  relation_type VARCHAR DEFAULT 'imports',
  strength      INT DEFAULT 5,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON file_dependencies (repo_id, source_file);
CREATE INDEX ON file_dependencies (repo_id, target_file);

-- Pull Requests
CREATE TABLE pull_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id           UUID REFERENCES repositories(id) ON DELETE CASCADE,
  org_id            UUID NOT NULL,
  pr_number         INT NOT NULL,
  github_pr_id      VARCHAR,
  title             VARCHAR NOT NULL,
  author            VARCHAR,
  body              TEXT,
  github_pr_url     VARCHAR,
  files_changed     JSONB DEFAULT '[]',
  risk_level        VARCHAR DEFAULT 'low',
  risk_score        INT DEFAULT 0,
  affected_services JSONB DEFAULT '[]',
  similar_prs       JSONB DEFAULT '[]',
  ai_analysis       TEXT,
  recommendations   JSONB DEFAULT '[]',
  github_comment_id VARCHAR,
  status            VARCHAR DEFAULT 'pending',
  pr_state          VARCHAR,
  source            VARCHAR(20) DEFAULT 'live',
  suggested_reviewers JSONB DEFAULT '[]',
  duplicate_code_findings JSONB DEFAULT '[]',
  embedding         vector(1536),
  pr_created_at     TIMESTAMPTZ,
  analyzed_at       TIMESTAMPTZ,
  first_review_at      TIMESTAMPTZ,
  merged_at            TIMESTAMPTZ,
  first_reviewer_login VARCHAR,
  review_count         INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repo_id, pr_number)
);

-- Indexes for pull_requests
CREATE INDEX ON pull_requests (org_id, risk_level, pr_created_at DESC);
CREATE INDEX ON pull_requests (org_id, status);
CREATE INDEX ON pull_requests USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- PR Notes (reviewer/admin comments on PRs)
CREATE TABLE pr_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id           UUID REFERENCES pull_requests(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  github_username VARCHAR,
  note            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON pr_notes (pr_id, created_at);

-- Subscriptions
CREATE TABLE subscriptions (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                       UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  tier                         VARCHAR DEFAULT 'free',
  status                       VARCHAR DEFAULT 'active',
  lemonsqueezy_subscription_id VARCHAR,
  lemonsqueezy_customer_id     VARCHAR,
  price_monthly                INT,
  current_period_start         TIMESTAMPTZ,
  current_period_end           TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

-- Usage Tracking
CREATE TABLE usage (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  month        VARCHAR NOT NULL,
  prs_analyzed INT DEFAULT 0,
  UNIQUE(org_id, month)
);

-- API Keys
CREATE TABLE api_keys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  hashed_key VARCHAR NOT NULL,
  name       VARCHAR NOT NULL,
  key_prefix VARCHAR NOT NULL,
  last_used  TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON api_keys (org_id);

-- Activity Log
CREATE TABLE activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  activity_type VARCHAR NOT NULL,
  description   TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON activity_log (org_id, created_at DESC);
CREATE INDEX ON activity_log (activity_type);

-- Join Links (shareable team invite links — admin generates, anyone can use)
CREATE TABLE join_links (
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

CREATE INDEX ON join_links (org_id, is_active, expires_at);

-- File-level git statistics (THE INSTITUTIONAL MEMORY)
CREATE TABLE file_git_stats (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id              UUID REFERENCES repositories(id) ON DELETE CASCADE,
  file_path            VARCHAR NOT NULL,
  total_commits        INT DEFAULT 0,
  commits_30d          INT DEFAULT 0,
  commits_90d          INT DEFAULT 0,
  commits_180d         INT DEFAULT 0,
  bus_factor           INT DEFAULT 1,
  primary_owner_email  VARCHAR,
  primary_owner_name   VARCHAR,
  primary_owner_pct    FLOAT DEFAULT 0,
  all_authors          JSONB DEFAULT '[]',
  incident_count       INT DEFAULT 0,
  revert_count         INT DEFAULT 0,
  last_commit_date     DATE,
  file_age_days        INT DEFAULT 0,
  churn_score          INT DEFAULT 0,
  knowledge_risk_score INT DEFAULT 0,
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repo_id, file_path)
);

CREATE INDEX idx_file_git_stats_repo ON file_git_stats (repo_id, knowledge_risk_score DESC);
CREATE INDEX idx_file_git_stats_bus ON file_git_stats (repo_id, bus_factor);

-- Repo-level git summary
CREATE TABLE repo_git_summary (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id                 UUID REFERENCES repositories(id) ON DELETE CASCADE UNIQUE,
  total_commits           INT DEFAULT 0,
  active_contributors_30d INT DEFAULT 0,
  total_contributors      INT DEFAULT 0,
  avg_bus_factor          FLOAT DEFAULT 0,
  knowledge_silo_count    INT DEFAULT 0,
  orphaned_files_count    INT DEFAULT 0,
  most_changed_file       VARCHAR,
  highest_risk_file       VARCHAR,
  indexed_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ADD THESE LINES TO THE END OF YOUR EXISTING schema.sql ─────────────────

-- Code Quality: Monthly file-level snapshots
CREATE TABLE file_metrics (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id               UUID REFERENCES repositories(id) ON DELETE CASCADE,
  file_path             TEXT NOT NULL,
  snapshot_month        DATE NOT NULL,
  lines_of_code         INT DEFAULT 0,
  blank_lines           INT DEFAULT 0,
  comment_lines         INT DEFAULT 0,
  cyclomatic_complexity INT DEFAULT 0,
  function_count        INT DEFAULT 0,
  file_age_days         INT DEFAULT 0,
  last_touch_date       DATE,
  language              VARCHAR(50),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repo_id, file_path, snapshot_month)
);

CREATE INDEX ON file_metrics (repo_id, snapshot_month DESC);
CREATE INDEX ON file_metrics (repo_id, cyclomatic_complexity DESC);
CREATE INDEX ON file_metrics (repo_id, lines_of_code DESC);

-- Code Quality: Repo-level monthly summary
CREATE TABLE repo_quality_summary (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id                   UUID REFERENCES repositories(id) ON DELETE CASCADE,
  snapshot_month            DATE NOT NULL,
  avg_complexity            NUMERIC(6,2),
  total_files               INT,
  total_loc                 INT,
  files_over_500_loc        INT,
  files_over_complexity_50  INT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repo_id, snapshot_month)
);

-- Cross-repo dependency graph
CREATE TABLE IF NOT EXISTS repo_dependencies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organizations(id) ON DELETE CASCADE,
  source_repo_id   UUID REFERENCES repositories(id) ON DELETE CASCADE,
  target_repo_id   UUID REFERENCES repositories(id) ON DELETE SET NULL,
  target_package   VARCHAR NOT NULL,
  dependency_type  VARCHAR CHECK (dependency_type IN ('npm_package','import_path','api_endpoint','docker_service')) DEFAULT 'npm_package',
  detected_files   JSONB DEFAULT '[]',
  confidence       NUMERIC(3,2) DEFAULT 0.90,
  last_detected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_repo_id, target_repo_id, target_package)
);

CREATE INDEX IF NOT EXISTS idx_repo_deps_source ON repo_dependencies (org_id, source_repo_id);
CREATE INDEX IF NOT EXISTS idx_repo_deps_target ON repo_dependencies (org_id, target_repo_id);

-- Cross-repo expert cache
CREATE TABLE IF NOT EXISTS cross_repo_experts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_github_login VARCHAR NOT NULL,
  topic             VARCHAR NOT NULL,
  repos_involved    JSONB DEFAULT '[]',
  total_score       NUMERIC(6,2) DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_github_login, topic)
);

CREATE INDEX IF NOT EXISTS idx_cross_experts_org ON cross_repo_experts (org_id, topic);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENGINEERINGOS PHASE 1 — AI Chief of Staff for CTOs
-- These tables power: Jira sync, GitHub history, pattern detection, daily briefs
-- ═══════════════════════════════════════════════════════════════════════════════

-- Jira OAuth connection per org (tokens stored AES-256-GCM encrypted)
CREATE TABLE IF NOT EXISTS jira_connections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  site_id             VARCHAR,
  site_url            VARCHAR,
  cloud_id            VARCHAR,
  access_token_enc    TEXT,
  refresh_token_enc   TEXT,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jira_connections_org ON jira_connections (org_id);

-- Selected Jira projects to monitor per org
CREATE TABLE IF NOT EXISTS jira_projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organizations(id) ON DELETE CASCADE,
  jira_project_id  VARCHAR NOT NULL,
  project_key      VARCHAR NOT NULL,
  project_name     VARCHAR NOT NULL,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, project_key)
);

CREATE INDEX IF NOT EXISTS idx_jira_projects_org ON jira_projects (org_id, is_active);

-- Jira sprints indexed from boards
CREATE TABLE IF NOT EXISTS jira_sprints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  jira_sprint_id    VARCHAR NOT NULL,
  project_key       VARCHAR NOT NULL,
  board_id          VARCHAR,
  name              VARCHAR NOT NULL,
  state             VARCHAR CHECK (state IN ('active','closed','future')) DEFAULT 'future',
  start_date        TIMESTAMPTZ,
  end_date          TIMESTAMPTZ,
  goal              TEXT,
  total_tickets     INT DEFAULT 0,
  completed_tickets INT DEFAULT 0,
  velocity_points   INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, jira_sprint_id)
);

CREATE INDEX IF NOT EXISTS idx_jira_sprints_org_state ON jira_sprints (org_id, state, end_date);

-- Jira tickets indexed (last 180 days)
CREATE TABLE IF NOT EXISTS jira_tickets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  jira_ticket_id    VARCHAR NOT NULL,
  project_key       VARCHAR NOT NULL,
  summary           TEXT NOT NULL,
  description       TEXT,
  assignee_jira_id  VARCHAR,
  reporter_jira_id  VARCHAR,
  status            VARCHAR,
  priority          VARCHAR,
  issue_type        VARCHAR,
  sprint_id         VARCHAR,
  epic_id           VARCHAR,
  story_points      NUMERIC(5,1),
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  linked_github_prs JSONB DEFAULT '[]',
  indexed_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, jira_ticket_id)
);

CREATE INDEX IF NOT EXISTS idx_jira_tickets_org ON jira_tickets (org_id, status, sprint_id);
CREATE INDEX IF NOT EXISTS idx_jira_tickets_assignee ON jira_tickets (org_id, assignee_jira_id, status);

-- GitHub commits indexed for EngineeringOS (separate from code_chunks)
CREATE TABLE IF NOT EXISTS github_commits_eos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  repo_id           UUID REFERENCES repositories(id) ON DELETE CASCADE,
  sha               VARCHAR NOT NULL,
  author_github_id  VARCHAR,
  author_login      VARCHAR,
  author_name       VARCHAR,
  author_email      VARCHAR,
  message           TEXT,
  files_changed     JSONB DEFAULT '[]',
  insertions        INT DEFAULT 0,
  deletions         INT DEFAULT 0,
  timestamp         TIMESTAMPTZ,
  branch            VARCHAR,
  linked_jira_keys  TEXT[] DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, sha)
);

CREATE INDEX IF NOT EXISTS idx_commits_eos_org_author ON github_commits_eos (org_id, author_github_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_commits_eos_repo ON github_commits_eos (repo_id, timestamp DESC);

-- GitHub pull requests indexed for EngineeringOS (separate from pull_requests)
CREATE TABLE IF NOT EXISTS github_prs_eos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID REFERENCES organizations(id) ON DELETE CASCADE,
  repo_id               UUID REFERENCES repositories(id) ON DELETE CASCADE,
  pr_number             INT NOT NULL,
  title                 VARCHAR NOT NULL,
  description           TEXT,
  author_github_id      VARCHAR,
  author_login          VARCHAR,
  state                 VARCHAR DEFAULT 'open',
  created_at            TIMESTAMPTZ,
  merged_at             TIMESTAMPTZ,
  closed_at             TIMESTAMPTZ,
  merge_duration_hours  FLOAT,
  files_changed         JSONB DEFAULT '[]',
  linked_jira_tickets   TEXT[] DEFAULT '{}',
  review_comments_count INT DEFAULT 0,
  commits_count         INT DEFAULT 0,
  has_reviewer          BOOLEAN DEFAULT false,
  reviewer_ids          TEXT[] DEFAULT '{}',
  head_branch           VARCHAR,
  indexed_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, repo_id, pr_number)
);

CREATE INDEX IF NOT EXISTS idx_prs_eos_org_state ON github_prs_eos (org_id, state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prs_eos_author ON github_prs_eos (org_id, author_github_id, state);

-- PR reviews for EngineeringOS
CREATE TABLE IF NOT EXISTS github_pr_reviews_eos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id               UUID REFERENCES github_prs_eos(id) ON DELETE CASCADE,
  org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE,
  reviewer_github_id  VARCHAR NOT NULL,
  reviewer_login      VARCHAR,
  state               VARCHAR CHECK (state IN ('approved','changes_requested','pending','commented','dismissed')) DEFAULT 'pending',
  submitted_at        TIMESTAMPTZ,
  comments_count      INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pr_reviews_eos_pr ON github_pr_reviews_eos (pr_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_reviews_eos_reviewer ON github_pr_reviews_eos (org_id, reviewer_github_id, submitted_at DESC);

-- File touch ownership (aggregated from commits — for reviewer suggestions)
CREATE TABLE IF NOT EXISTS github_files_touched (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  repo_id           UUID REFERENCES repositories(id) ON DELETE CASCADE,
  file_path         VARCHAR NOT NULL,
  author_github_id  VARCHAR NOT NULL,
  author_login      VARCHAR,
  touch_count       INT DEFAULT 1,
  last_touched_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, repo_id, file_path, author_github_id)
);

CREATE INDEX IF NOT EXISTS idx_files_touched_file ON github_files_touched (repo_id, file_path, touch_count DESC);
CREATE INDEX IF NOT EXISTS idx_files_touched_author ON github_files_touched (org_id, author_github_id);

-- GitHub <-> Jira team member mapping (CRITICAL — links commits to sprint tickets)
CREATE TABLE IF NOT EXISTS team_member_mappings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID REFERENCES organizations(id) ON DELETE CASCADE,
  github_login        VARCHAR,
  github_id           VARCHAR,
  github_email        VARCHAR,
  jira_account_id     VARCHAR,
  jira_display_name   VARCHAR,
  jira_email          VARCHAR,
  is_confirmed        BOOLEAN DEFAULT false,
  mapped_at           TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, github_login),
  UNIQUE(org_id, jira_account_id)
);

CREATE INDEX IF NOT EXISTS idx_team_mappings_org ON team_member_mappings (org_id);
CREATE INDEX IF NOT EXISTS idx_team_mappings_github ON team_member_mappings (org_id, github_id);
CREATE INDEX IF NOT EXISTS idx_team_mappings_jira ON team_member_mappings (org_id, jira_account_id);

-- Daily briefs archive
CREATE TABLE IF NOT EXISTS daily_briefs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  brief_date      DATE NOT NULL,
  content_slack   JSONB,
  content_email   TEXT,
  content_raw     TEXT,
  pattern_count   INT DEFAULT 0,
  severity_high   INT DEFAULT 0,
  severity_medium INT DEFAULT 0,
  sent_at         TIMESTAMPTZ,
  sent_via        VARCHAR,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, brief_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_org ON daily_briefs (org_id, brief_date DESC);

-- Individual pattern items in a daily brief
CREATE TABLE IF NOT EXISTS brief_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id          UUID REFERENCES daily_briefs(id) ON DELETE CASCADE,
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  pattern_type      VARCHAR NOT NULL CHECK (pattern_type IN ('stale_pr','silent_engineer','sprint_slip','no_reviewer')),
  severity          VARCHAR NOT NULL CHECK (severity IN ('HIGH','MEDIUM','LOW')),
  title             TEXT NOT NULL,
  description       TEXT,
  action_suggestion TEXT,
  engineer_github_id VARCHAR,
  pr_id             UUID REFERENCES github_prs_eos(id) ON DELETE SET NULL,
  ticket_id         UUID REFERENCES jira_tickets(id) ON DELETE SET NULL,
  is_acknowledged   BOOLEAN DEFAULT false,
  is_dismissed      BOOLEAN DEFAULT false,
  snoozed_until     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brief_items_brief ON brief_items (brief_id, severity);
CREATE INDEX IF NOT EXISTS idx_brief_items_org ON brief_items (org_id, created_at DESC);

-- Slack incoming webhook config per org
CREATE TABLE IF NOT EXISTS slack_connections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  webhook_url  TEXT NOT NULL,
  channel_name VARCHAR,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding step tracker (6 steps)
CREATE TABLE IF NOT EXISTS onboarding_state (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  step_github       BOOLEAN DEFAULT false,
  step_jira         BOOLEAN DEFAULT false,
  step_team_mapped  BOOLEAN DEFAULT false,
  step_configured   BOOLEAN DEFAULT false,
  step_previewed    BOOLEAN DEFAULT false,
  completed         BOOLEAN DEFAULT false,
  index_started_at  TIMESTAMPTZ,
  index_progress    INT DEFAULT 0,
  index_message     TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Brief delivery config per org
CREATE TABLE IF NOT EXISTS brief_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  delivery_time           VARCHAR DEFAULT '08:00',
  delivery_timezone       VARCHAR DEFAULT 'UTC',
  slack_enabled           BOOLEAN DEFAULT true,
  email_enabled           BOOLEAN DEFAULT true,
  stale_pr_days           INT DEFAULT 3,
  sprint_risk_threshold   INT DEFAULT 40,
  silent_engineer_days    INT DEFAULT 3,
  -- Phase 1.5: weekly report settings
  weekly_report_enabled   BOOLEAN DEFAULT true,
  weekly_report_day       TEXT DEFAULT 'friday',
  weekly_report_time      TEXT DEFAULT '17:00',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Phase 1.5: Weekly engineering health reports
CREATE TABLE IF NOT EXISTS weekly_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  week_end        DATE NOT NULL,
  content_raw     TEXT,
  content_slack   JSONB,
  content_email   TEXT,
  metrics         JSONB DEFAULT '{}',
  pattern_summary JSONB DEFAULT '[]',
  sent_at         TIMESTAMPTZ,
  sent_via        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_org_week ON weekly_reports(org_id, week_start DESC);

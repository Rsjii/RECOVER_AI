import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../../config/db';
import { analysisQueue, reindexQueue } from '../../jobs/queue';
import { getPlan } from '../../config/plans';
import { logger } from '../../config/logger';
import { GitHubPRWebhookPayload } from '../../types/github';
import { jiraSyncQueue } from '../../jobs/eosQueue';

export const handleGitHubPR = async (req: Request, res: Response) => {
  const repoId = req.params.repoId;

  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      logger.warn(`[Webhook] No signature for repo ${repoId}`);
      return res.status(200).json({ skipped: 'no_signature' });
    }

    const repoRes = await db.query(
      `SELECT r.*, s.tier, s.status as sub_status
       FROM repositories r
       LEFT JOIN subscriptions s ON s.org_id = r.org_id
       WHERE r.id = $1`,
      [repoId]
    );

    if (repoRes.rows.length === 0) {
      logger.warn(`[Webhook] Unknown repo ${repoId}`);
      return res.status(200).json({ skipped: 'unknown_repo' });
    }

    const repo = repoRes.rows[0];

    const secret = repo.webhook_secret;
    if (secret) {
      const rawBody = req.body;
      const hmac    = crypto.createHmac('sha256', secret);
      const digest  = 'sha256=' + hmac.update(rawBody).digest('hex');
      if (signature !== digest) {
        logger.warn(`[Webhook] Invalid signature for repo ${repoId}`);
        return res.status(200).json({ skipped: 'invalid_signature' });
      }
    }

    const event = req.headers['x-github-event'] as string;

    // ── REVIEW EVENT → capture first_review_at + reviewer ────────────────────
    if (event === 'pull_request_review') {
      const reviewPayload = JSON.parse(req.body.toString());
      if (reviewPayload.action !== 'submitted') {
        return res.status(200).json({ skipped: 'review_not_submitted' });
      }
      const prNumber     = reviewPayload.pull_request?.number;
      const reviewerLogin = reviewPayload.review?.user?.login;
      const submittedAt  = reviewPayload.review?.submitted_at;
      if (prNumber && reviewerLogin && submittedAt) {
        await db.query(
          `UPDATE pull_requests
           SET first_review_at    = COALESCE(first_review_at, $1),
               first_reviewer_login = CASE WHEN first_review_at IS NULL THEN $2 ELSE first_reviewer_login END,
               review_count       = review_count + 1
           WHERE repo_id = $3 AND pr_number = $4`,
          [submittedAt, reviewerLogin, repoId, prNumber]
        ).catch(() => {});
      }
      return res.status(200).json({ updated: 'review_timestamps' });
    }

    if (event !== 'pull_request') {
      return res.status(200).json({ skipped: 'not_pr_event' });
    }

    const payload: GitHubPRWebhookPayload = JSON.parse(req.body.toString());
    const { action, pull_request: pr } = payload;

    // ── PR MERGED → capture merged_at + queue partial re-index ──────────────
    if (action === 'closed' && (payload as any).pull_request.merged === true) {
      const mergedAt = (payload as any).pull_request.merged_at || new Date().toISOString();
      await db.query(
        `UPDATE pull_requests SET merged_at = $1 WHERE repo_id = $2 AND pr_number = $3`,
        [mergedAt, repoId, pr.number]
      ).catch(() => {});

      await reindexQueue.add('reindex', {
        repoId,
        orgId:        repo.org_id,
        prNumber:     pr.number,
        repoFullName: repo.full_name,
      }, {
        attempts: 2,
        delay:    3000,
        backoff:  { type: 'exponential', delay: 5000 },
      });
      logger.info(`[Webhook] PR #${pr.number} merged — partial re-index queued for ${repo.full_name}`);
      return res.status(200).json({ queued_reindex: true });
    }

    // ── PR CLOSED WITHOUT MERGE → update pr_state in DB ──────────────────────
    // BUG FIX: PR abandoned/declined should not stay as 'open' in our DB
    if (action === 'closed' && (payload as any).pull_request.merged === false) {
      await db.query(
        `UPDATE pull_requests SET pr_state = 'closed' WHERE repo_id = $1 AND pr_number = $2`,
        [repoId, pr.number]
      ).catch(() => {}); // non-fatal
      logger.info(`[Webhook] PR #${pr.number} closed (not merged) — state updated`);
      return res.status(200).json({ updated_state: 'closed' });
    }

    // ── Skip non-analysis actions ─────────────────────────────────────────────
    if (action !== 'opened' && action !== 'synchronize') {
      return res.status(200).json({ skipped: 'irrelevant_action' });
    }

    // ── Check subscription ────────────────────────────────────────────────────
    if (repo.sub_status && repo.sub_status !== 'active') {
      return res.status(200).json({ skipped: 'subscription_inactive' });
    }

    // ── Check monthly PR limit ────────────────────────────────────────────────
    const plan  = getPlan(repo.tier || 'free');
    const month = new Date().toISOString().slice(0, 7);
    const usageRes = await db.query(
      `SELECT prs_analyzed FROM usage WHERE org_id = $1 AND month = $2`,
      [repo.org_id, month]
    );
    const analyzed = usageRes.rows[0]?.prs_analyzed || 0;
    if (analyzed >= plan.maxPRsPerMonth) {
      logger.info(`[Webhook] PR limit reached for org ${repo.org_id}`);
      return res.status(200).json({ skipped: 'monthly_limit_reached' });
    }

    // ── Queue PR analysis (BUG FIX: jobId deduplication) ─────────────────────
    // Same jobId = BullMQ ignores duplicate (rapid pushes → only 1 analysis job)
    await analysisQueue.add('analyze', {
      repoId,
      orgId:        repo.org_id,
      prNumber:     pr.number,
      prTitle:      pr.title,
      prUrl:        pr.html_url,
      repoFullName: repo.full_name,
      action,
    }, {
      jobId:   `analyze-${repoId}-${pr.number}`,  // deduplicates rapid pushes
      attempts: 3,
      backoff:  { type: 'exponential', delay: 5000 },
    });

    logger.info(`[Webhook] PR #${pr.number} queued for analysis (repo: ${repo.full_name})`);
    return res.status(200).json({ queued: true });
  } catch (err: any) {
    logger.error({ err }, `[Webhook] Error processing PR event for repo ${repoId}`);
    return res.status(200).json({ error: 'internal' });
  }
};

// ── EngineeringOS: Jira webhook ───────────────────────────────────────────────
// Register in Jira: Settings → System → Webhooks → URL: /webhooks/jira?org=<orgId>
// Events: Issue Created, Issue Updated, Sprint Created, Sprint Started, Sprint Closed
export const handleJiraWebhook = async (req: Request, res: Response) => {
  const orgId = req.query['org'] as string;
  if (!orgId) return res.status(200).json({ skipped: 'no_org' });

  try {
    const payload = JSON.parse((req.body as Buffer).toString());
    const webhookEvent: string = payload.webhookEvent || '';

    let eventType: string | null = null;
    let ticketId: string | null  = null;
    let sprintId: string | null  = null;

    if (webhookEvent === 'jira:issue_created') {
      eventType = 'issue_created';
      ticketId  = payload.issue?.key;
    } else if (webhookEvent === 'jira:issue_updated') {
      eventType = 'issue_updated';
      ticketId  = payload.issue?.key;
    } else if (webhookEvent === 'sprint_created' || webhookEvent === 'sprint_started') {
      eventType = 'sprint_started';
      sprintId  = String(payload.sprint?.id);
    } else if (webhookEvent === 'sprint_closed') {
      eventType = 'sprint_closed';
      sprintId  = String(payload.sprint?.id);
    }

    if (!eventType) {
      return res.status(200).json({ skipped: 'unhandled_event', webhookEvent });
    }

    // Verify org exists and has Jira connected
    const conn = await db.query(
      `SELECT id FROM jira_connections WHERE org_id = $1 LIMIT 1`,
      [orgId]
    );
    if (!conn.rows[0]) return res.status(200).json({ skipped: 'org_not_found' });

    await jiraSyncQueue.add('sync', { orgId, eventType, ticketId, sprintId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    logger.info({ orgId, eventType }, '[Webhook] Jira event queued');
    return res.status(200).json({ queued: true });
  } catch (err: any) {
    logger.error({ err }, '[Webhook] Jira webhook error');
    return res.status(200).json({ error: 'internal' }); // Always 200 to Jira
  }
};

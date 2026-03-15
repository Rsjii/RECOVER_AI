import { Job } from 'bullmq';
import { logger } from '../config/logger';
import { db } from '../config/db';
import { githubHistoricalService } from '../services/githubHistoricalService';
import { jiraService } from '../services/jiraService';
import { teamMappingService } from '../services/teamMappingService';

/**
 * Historical index job — Day 6-7 implementation
 * Indexes 180 days of GitHub commits + PRs + Jira tickets + sprints for a given org.
 * Triggered once on onboarding complete.
 */
export async function processHistoricalIndexJob(job: Job) {
  const { orgId } = job.data;
  logger.info({ orgId }, '[HistoricalIndex] Starting 180-day historical index');

  const updateProgress = async (progress: number, message: string) => {
    await job.updateProgress(progress);
    await db.query(
      `UPDATE onboarding_state SET index_progress = $1, index_message = $2, updated_at = NOW()
       WHERE org_id = $3`,
      [progress, message, orgId]
    );
    logger.info({ orgId, progress, message }, '[HistoricalIndex] Progress');
  };

  try {
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

    // Step 1: Index GitHub commits (all selected repos)
    await updateProgress(5, 'Fetching GitHub commits (180 days)...');
    const repos = await db.query(
      `SELECT id, full_name FROM repositories WHERE org_id = $1 AND status != 'error'`,
      [orgId]
    );
    for (const repo of repos.rows) {
      await githubHistoricalService.indexCommits(orgId, repo.id, repo.full_name, since);
    }

    // Step 2: Index GitHub PRs
    await updateProgress(25, 'Fetching GitHub pull requests...');
    for (const repo of repos.rows) {
      await githubHistoricalService.indexPullRequests(orgId, repo.id, repo.full_name, since);
    }

    // Step 3: Index PR reviews
    await updateProgress(40, 'Fetching PR reviews...');
    for (const repo of repos.rows) {
      await githubHistoricalService.indexPRReviews(orgId, repo.id, repo.full_name);
    }

    // Step 4: Build files touched (aggregated from commits)
    await updateProgress(55, 'Building file ownership map...');
    for (const repo of repos.rows) {
      await githubHistoricalService.buildFilesTouched(orgId, repo.id);
    }

    // Step 5: Index Jira tickets (last 180 days, all selected projects)
    await updateProgress(65, 'Fetching Jira tickets (180 days)...');
    await jiraService.indexTickets(orgId, since);

    // Step 6: Index Jira sprints
    await updateProgress(80, 'Fetching Jira sprints...');
    await jiraService.indexSprints(orgId);

    // Step 7: Auto-map team members (email match + fuzzy)
    await updateProgress(90, 'Mapping GitHub ↔ Jira team members...');
    await teamMappingService.autoMapMembers(orgId);

    // Step 8: Link PRs to Jira tickets bidirectionally
    await updateProgress(95, 'Linking GitHub PRs ↔ Jira tickets...');
    await githubHistoricalService.linkJiraTickets(orgId);

    // Done
    await db.query(
      `UPDATE onboarding_state
       SET completed = true, index_progress = 100,
           index_message = '180-day historical index complete!', updated_at = NOW()
       WHERE org_id = $1`,
      [orgId]
    );

    logger.info({ orgId }, '[HistoricalIndex] Complete');
  } catch (err) {
    logger.error({ err, orgId }, '[HistoricalIndex] Failed');
    await db.query(
      `UPDATE onboarding_state SET index_message = $1, updated_at = NOW() WHERE org_id = $2`,
      [`Error: ${(err as Error).message}`, orgId]
    );
    throw err;
  }
}

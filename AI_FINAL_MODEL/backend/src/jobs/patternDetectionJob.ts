import { Job } from 'bullmq';
import { logger } from '../config/logger';
import { db } from '../config/db';
import { patternDetectionService } from '../services/patternDetectionService';

/**
 * Nightly pattern detection job — runs at 11pm UTC for all active orgs
 * Detects: stale PRs, silent engineers, sprint slip risk, reviewer overload
 */
export async function processPatternDetectionJob(job: Job) {
  const { allOrgs, orgId } = job.data;
  logger.info({ allOrgs, orgId }, '[PatternDetection] Job started');

  try {
    if (allOrgs) {
      // Run for all orgs that have completed onboarding
      const orgs = await db.query(
        `SELECT org_id FROM onboarding_state WHERE completed = true`
      );
      for (const row of orgs.rows) {
        await patternDetectionService.runAllPatterns(row.org_id);
      }
      logger.info({ count: orgs.rows.length }, '[PatternDetection] Ran for all orgs');
    } else if (orgId) {
      await patternDetectionService.runAllPatterns(orgId);
      logger.info({ orgId }, '[PatternDetection] Done for org');
    }
  } catch (err) {
    logger.error({ err }, '[PatternDetection] Failed');
    throw err;
  }
}

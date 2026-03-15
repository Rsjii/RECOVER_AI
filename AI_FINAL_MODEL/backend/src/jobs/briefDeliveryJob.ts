import { Job } from 'bullmq';
import { logger } from '../config/logger';
import { db } from '../config/db';
import { patternDetectionService } from '../services/patternDetectionService';
import { briefGenerationService } from '../services/briefGenerationService';
import { deliveryService } from '../services/deliveryService';

/**
 * Morning brief delivery job — runs every 15 min, delivers to orgs whose delivery_time matches
 */
export async function processBriefDeliveryJob(job: Job) {
  const { allOrgs, orgId } = job.data;
  logger.info({ allOrgs, orgId }, '[BriefDelivery] Job started');

  try {
    const now = new Date();
    const currentHHMM = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

    // Find orgs whose delivery_time is within the last 15 minutes window
    const orgsToDeliver = allOrgs
      ? await db.query(
          `SELECT bc.org_id, bc.delivery_time, bc.slack_enabled, bc.email_enabled
           FROM brief_config bc
           JOIN onboarding_state os ON os.org_id = bc.org_id
           WHERE os.completed = true
             AND bc.delivery_time >= $1 AND bc.delivery_time < $2
             AND NOT EXISTS (
               SELECT 1 FROM daily_briefs db
               WHERE db.org_id = bc.org_id AND db.brief_date = CURRENT_DATE AND db.sent_at IS NOT NULL
             )`,
          [currentHHMM, addMinutes(currentHHMM, 15)]
        )
      : { rows: orgId ? [{ org_id: orgId }] : [] };

    logger.info({ count: orgsToDeliver.rows.length }, '[BriefDelivery] Orgs to deliver');

    for (const row of orgsToDeliver.rows) {
      await deliverBriefForOrg(row.org_id);
    }
  } catch (err) {
    logger.error({ err }, '[BriefDelivery] Failed');
    throw err;
  }
}

async function deliverBriefForOrg(orgId: string) {
  try {
    logger.info({ orgId }, '[BriefDelivery] Generating brief');
    const patterns = await patternDetectionService.runAllPatterns(orgId);
    const contentRaw = await briefGenerationService.generateBrief(orgId, patterns);
    const saved = await briefGenerationService.saveBrief(orgId, contentRaw, patterns);
    await deliveryService.deliverBrief(orgId, saved.id);
    logger.info({ orgId, briefId: saved.id }, '[BriefDelivery] Delivered');
  } catch (err) {
    logger.error({ err, orgId }, '[BriefDelivery] Failed for org');
  }
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const totalMins = h * 60 + m + minutes;
  return `${String(Math.floor(totalMins / 60) % 24).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
}

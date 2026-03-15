// EngineeringOS Phase 1.5 — Weekly Report Job
// Generates and delivers the Friday engineering health report
import { Job } from 'bullmq';
import { db } from '../config/db';
import { logger } from '../config/logger';
import { weeklyReportService } from '../services/weeklyReportService';
import { deliveryService } from '../services/deliveryService';

function getWeekBounds(): { weekStart: string; weekEnd: string } {
  const now  = new Date();
  const day  = now.getUTCDay(); // 0=Sun,5=Fri
  // Start of this Mon–Sun week
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() + mondayOffset);
  mon.setUTCHours(0, 0, 0, 0);

  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);

  return {
    weekStart: mon.toISOString().split('T')[0],
    weekEnd:   sun.toISOString().split('T')[0],
  };
}

async function shouldDeliver(orgId: string, weekStart: string): Promise<boolean> {
  // Skip if already sent for this week
  const { rows } = await db.query(
    `SELECT id FROM weekly_reports WHERE org_id = $1 AND week_start = $2 AND sent_at IS NOT NULL`,
    [orgId, weekStart]
  );
  return rows.length === 0;
}

async function processOrgWeeklyReport(orgId: string) {
  const { weekStart, weekEnd } = getWeekBounds();

  if (!(await shouldDeliver(orgId, weekStart))) {
    logger.info({ orgId, weekStart }, '[WeeklyReport] Already sent — skipping');
    return;
  }

  // Check org config — weekly report must be enabled
  const cfgRes = await db.query(
    `SELECT weekly_report_enabled, slack_enabled, email_enabled
     FROM brief_config WHERE org_id = $1`,
    [orgId]
  );
  const cfg = cfgRes.rows[0];
  if (!cfg || cfg.weekly_report_enabled === false) {
    logger.info({ orgId }, '[WeeklyReport] Disabled for org — skipping');
    return;
  }

  logger.info({ orgId, weekStart }, '[WeeklyReport] Generating weekly report');

  const { metrics, patternSummary } = await weeklyReportService.aggregateWeekData(orgId);
  const contentRaw   = await weeklyReportService.generateReport(orgId, metrics, patternSummary);
  const contentSlack = weeklyReportService.buildSlackPayload(contentRaw, metrics, weekStart, weekEnd);
  const contentEmail = weeklyReportService.buildEmailHtml(contentRaw, metrics, weekStart, weekEnd);

  const saved = await weeklyReportService.saveReport(
    orgId, weekStart, weekEnd,
    contentRaw, contentSlack, contentEmail,
    metrics, patternSummary
  );

  const sentVia: string[] = [];

  if (cfg.slack_enabled !== false) {
    const slackOk = await deliveryService.sendToSlack(orgId, contentSlack);
    if (slackOk) sentVia.push('slack');
  }

  if (cfg.email_enabled === true) {
    const orgRes = await db.query(`SELECT github_org_name FROM organizations WHERE id = $1`, [orgId]);
    const orgName = orgRes.rows[0]?.github_org_name || 'Your Team';
    const emailOk = await deliveryService.sendEmail(
      orgId,
      contentEmail,
      `Weekly Engineering Report — ${orgName}`
    );
    if (emailOk) sentVia.push('email');
  }

  if (sentVia.length > 0) {
    await weeklyReportService.markSent(saved.id, sentVia.join(','));
  }

  logger.info({ orgId, weekStart, sentVia }, '[WeeklyReport] Done');
}

export async function processWeeklyReportJob(job: Job) {
  const { orgId, allOrgs } = job.data as { orgId?: string; allOrgs?: boolean };

  if (orgId) {
    await processOrgWeeklyReport(orgId);
    return;
  }

  if (allOrgs) {
    // Only deliver on Fridays (or if forced via job data)
    const isForced = !!job.data.force;
    const dayOfWeek = new Date().getUTCDay(); // 5 = Friday
    if (dayOfWeek !== 5 && !isForced) {
      logger.info('[WeeklyReport] Not Friday — skipping batch run');
      return;
    }

    // Get all orgs with onboarding complete
    const { rows } = await db.query(
      `SELECT org_id FROM onboarding_state WHERE completed = true`
    );

    await Promise.allSettled(
      rows.map(r => processOrgWeeklyReport(r.org_id).catch(err =>
        logger.error({ err, orgId: r.org_id }, '[WeeklyReport] Org failed')
      ))
    );
  }
}

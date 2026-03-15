import { Job } from 'bullmq';
import { logger } from '../config/logger';
import { jiraService } from '../services/jiraService';

/**
 * Jira incremental sync job — triggered by Jira webhooks
 * Handles: issue_updated, issue_created, sprint_started, sprint_closed
 */
export async function processJiraSyncJob(job: Job) {
  const { orgId, eventType, ticketId, sprintId } = job.data;
  logger.info({ orgId, eventType }, '[JiraSync] Processing Jira event');

  try {
    if (eventType === 'issue_created' || eventType === 'issue_updated') {
      await jiraService.syncTicket(orgId, ticketId);
    } else if (eventType === 'sprint_started' || eventType === 'sprint_closed') {
      await jiraService.syncSprint(orgId, sprintId);
    }
    logger.info({ orgId, eventType }, '[JiraSync] Done');
  } catch (err) {
    logger.error({ err, orgId, eventType }, '[JiraSync] Failed');
    throw err;
  }
}

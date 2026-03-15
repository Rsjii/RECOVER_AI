import axios, { AxiosInstance } from 'axios';
import { db } from '../config/db';
import { logger } from '../config/logger';
import { jiraOAuthService } from './jiraOAuthService';

const ATLASSIAN_API = 'https://api.atlassian.com';
const ACCESSIBLE_RESOURCES_URL = `${ATLASSIAN_API}/oauth/token/accessible-resources`;

/** Create an Axios instance pre-configured with a valid token for an org */
async function getClient(orgId: string): Promise<{ client: AxiosInstance; cloudId: string }> {
  const token = await jiraOAuthService.getValidToken(orgId);
  const conn = await db.query(
    `SELECT cloud_id FROM jira_connections WHERE org_id = $1`,
    [orgId]
  );
  const cloudId = conn.rows[0]?.cloud_id || '';

  const client = axios.create({
    baseURL: `${ATLASSIAN_API}/ex/jira/${cloudId}`,
    headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/json' },
  });

  return { client, cloudId };
}

/** Paginated GET helper — keeps fetching until all results collected */
async function paginatedGet<T>(
  client: AxiosInstance,
  url: string,
  params: Record<string, any>,
  extractFn: (data: any) => T[],
  startAt = 0,
  maxTotal = 10000
): Promise<T[]> {
  const results: T[] = [];
  let currentStart = startAt;
  const maxResults = params['maxResults'] || 100;

  while (results.length < maxTotal) {
    const res = await client.get(url, { params: { ...params, startAt: currentStart } });
    const page = extractFn(res.data);
    results.push(...page);

    const total = res.data.total ?? res.data.maxResults ?? page.length;
    if (results.length >= total || page.length < maxResults) break;
    currentStart += maxResults;

    // Rate limit: small delay between pages
    await new Promise(r => setTimeout(r, 60));
  }

  return results;
}

export const jiraService = {
  /** List all Jira sites the user has access to */
  async getSites(orgId: string) {
    const token = await jiraOAuthService.getValidToken(orgId);
    const res = await axios.get(ACCESSIBLE_RESOURCES_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data as Array<{ id: string; name: string; url: string; avatarUrl: string }>;
  },

  /** List all projects in the connected Jira site */
  async getProjects(orgId: string) {
    const { client } = await getClient(orgId);
    return paginatedGet(
      client,
      '/rest/api/3/project/search',
      { maxResults: 50, expand: 'description' },
      (data) => data.values || []
    );
  },

  /** List all users in the connected Jira site */
  async getUsers(orgId: string) {
    const { client } = await getClient(orgId);
    return paginatedGet(
      client,
      '/rest/api/3/users/search',
      { maxResults: 50 },
      (data) => Array.isArray(data) ? data : []
    );
  },

  /** List all boards for selected projects */
  async getBoards(orgId: string) {
    const { client } = await getClient(orgId);
    const projects = await db.query(
      `SELECT project_key FROM jira_projects WHERE org_id = $1 AND is_active = true`,
      [orgId]
    );
    const boards: any[] = [];
    for (const p of projects.rows) {
      const page = await paginatedGet(
        client,
        '/rest/agile/1.0/board',
        { maxResults: 50, projectKeyOrId: p.project_key },
        (data) => data.values || []
      );
      boards.push(...page);
    }
    return boards;
  },

  /** Index 180 days of tickets for all active projects */
  async indexTickets(orgId: string, since: string) {
    const { client } = await getClient(orgId);
    const projects = await db.query(
      `SELECT project_key FROM jira_projects WHERE org_id = $1 AND is_active = true`,
      [orgId]
    );

    for (const p of projects.rows) {
      const jql = `project = "${p.project_key}" AND updated >= "${since.split('T')[0]}" ORDER BY updated DESC`;
      const tickets = await paginatedGet(
        client,
        '/rest/api/3/search',
        { jql, maxResults: 100, fields: 'summary,description,assignee,reporter,status,priority,issuetype,sprint,epic,story_points,customfield_10016,customfield_10014,created,updated,resolutiondate' },
        (data) => data.issues || []
      );

      for (const t of tickets as any[]) {
        const fields = t.fields;
        const sprintField = fields.customfield_10020 || fields.sprint;
        const sprintId = Array.isArray(sprintField) ? sprintField[0]?.id?.toString() : sprintField?.id?.toString();
        const epicId = fields.customfield_10014 || fields.epic?.id;
        const storyPoints = fields.story_points || fields.customfield_10016;

        await db.query(
          `INSERT INTO jira_tickets (org_id, jira_ticket_id, project_key, summary, description,
             assignee_jira_id, reporter_jira_id, status, priority, issue_type,
             sprint_id, epic_id, story_points, created_at, updated_at, resolved_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           ON CONFLICT (org_id, jira_ticket_id) DO UPDATE SET
             status = $8, updated_at = $15, resolved_at = $16, sprint_id = $11, indexed_at = NOW()`,
          [
            orgId, t.id, p.project_key, fields.summary,
            fields.description?.content ? JSON.stringify(fields.description.content) : null,
            fields.assignee?.accountId || null,
            fields.reporter?.accountId || null,
            fields.status?.name || null,
            fields.priority?.name || null,
            fields.issuetype?.name || null,
            sprintId || null,
            epicId || null,
            storyPoints || null,
            fields.created, fields.updated, fields.resolutiondate || null,
          ]
        );
      }

      logger.info({ orgId, projectKey: p.project_key, count: tickets.length }, '[Jira] Tickets indexed');
    }
  },

  /** Index sprints for all boards of active projects */
  async indexSprints(orgId: string) {
    const { client } = await getClient(orgId);
    const boards = await jiraService.getBoards(orgId);

    for (const board of boards) {
      const sprints = await paginatedGet(
        client,
        `/rest/agile/1.0/board/${board.id}/sprint`,
        { maxResults: 50 },
        (data) => data.values || []
      );

      for (const s of sprints as any[]) {
        // Count tickets for this sprint
        const countRes = await client.get('/rest/api/3/search', {
          params: { jql: `sprint = ${s.id}`, maxResults: 0, fields: 'status' },
        }).catch(() => ({ data: { total: 0 } }));

        const doneRes = await client.get('/rest/api/3/search', {
          params: { jql: `sprint = ${s.id} AND status = Done`, maxResults: 0 },
        }).catch(() => ({ data: { total: 0 } }));

        await db.query(
          `INSERT INTO jira_sprints (org_id, jira_sprint_id, project_key, board_id, name, state, start_date, end_date, goal, total_tickets, completed_tickets)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (org_id, jira_sprint_id) DO UPDATE SET
             state = $6, start_date = $7, end_date = $8, goal = $9,
             total_tickets = $10, completed_tickets = $11, updated_at = NOW()`,
          [
            orgId, s.id.toString(), board.location?.projectKey || '',
            board.id.toString(), s.name, s.state?.toLowerCase() || 'future',
            s.startDate || null, s.endDate || null, s.goal || null,
            countRes.data.total, doneRes.data.total,
          ]
        );
      }

      logger.info({ orgId, boardId: board.id, count: sprints.length }, '[Jira] Sprints indexed');
    }
  },

  /** Sync a single ticket (called on webhook update) */
  async syncTicket(orgId: string, jiraTicketId: string) {
    const { client } = await getClient(orgId);
    const res = await client.get(`/rest/api/3/issue/${jiraTicketId}`);
    const t = res.data;
    const fields = t.fields;

    await db.query(
      `INSERT INTO jira_tickets (org_id, jira_ticket_id, project_key, summary, status, assignee_jira_id, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (org_id, jira_ticket_id) DO UPDATE SET
         status = $5, assignee_jira_id = $6, updated_at = $7, indexed_at = NOW()`,
      [orgId, t.id, t.fields.project?.key, fields.summary, fields.status?.name, fields.assignee?.accountId, fields.updated]
    );
  },

  /** Sync a single sprint (called on webhook update) */
  async syncSprint(orgId: string, jiraSprintId: string) {
    const { client } = await getClient(orgId);
    const res = await client.get(`/rest/agile/1.0/sprint/${jiraSprintId}`);
    const s = res.data;

    await db.query(
      `UPDATE jira_sprints SET state = $1, end_date = $2, updated_at = NOW()
       WHERE org_id = $3 AND jira_sprint_id = $4`,
      [s.state?.toLowerCase(), s.endDate, orgId, jiraSprintId]
    );
  },
};

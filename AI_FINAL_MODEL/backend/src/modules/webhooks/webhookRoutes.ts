import { Router } from 'express';
import * as ctrl from './webhookController';
import { handleSlackAction } from '../slack/slackController';

const router = Router();

// Raw body middleware already applied in app.ts for /webhooks path
router.post('/github/:repoId', ctrl.handleGitHubPR);

// EngineeringOS Phase 1: Jira incremental sync
// Register in Jira: Settings → Webhooks → URL: /webhooks/jira?org=<orgId>
router.post('/jira', ctrl.handleJiraWebhook);

// EngineeringOS Phase 1: Slack interactive button callbacks
// Slack sends URL-encoded payload — urlencoded parser applied before this in app.ts
router.post('/slack-actions', handleSlackAction);

export default router;

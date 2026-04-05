import { Router, Request, Response } from 'express';
import { handleSlackEvent, handleSlackCommand, handleSlackInteraction } from '../controllers/slackBotController';
import { logInfo, logError } from '../utils/logger';

const router = Router();

const LOG_MODULE = 'slackRoutes';

// Middleware: Block access to Slack OAuth (hidden integration)
const slackDisabled = (req: Request, res: Response, next: Function) => {
  const path = req.path;
  if (path.includes('authorize') || path.includes('callback')) {
    logInfo(LOG_MODULE, 'slackDisabled', 'Slack OAuth endpoint disabled');
    return res.status(404).json({ error: 'Not found' });
  }
  next();
};

/**
 * Slack Events API endpoint
 * POST /api/slack/events
 *
 * Receives:
 * 1. URL verification challenge (on app setup)
 * 2. Event callbacks (messages, app mentions, etc.)
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const { type, challenge } = req.body;

    // Slack verification: respond with challenge token
    if (type === 'url_verification') {
      logInfo(LOG_MODULE, '/events', 'Slack verification challenge received');
      return res.json({ challenge });
    }

    // Slack is retrying or resending old events - acknowledge immediately
    if (type === 'event_callback') {
      res.status(200).json({ ok: true });

      // Process event asynchronously (don't wait for response)
      try {
        await handleSlackEvent(req.body);
      } catch (err) {
        logError(LOG_MODULE, '/events', 'Failed to handle Slack event', err);
      }
      return;
    }

    res.status(400).json({ error: 'Unknown event type' });
  } catch (err) {
    logError(LOG_MODULE, '/events', 'Slack event processing failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * Slack Slash Commands endpoint
 * POST /api/slack/commands
 *
 * User types: /recover status
 * Slack calls this endpoint with command details
 */
router.post('/commands', async (req: Request, res: Response) => {
  try {
    const { command, text, user_id, team_id, channel_id, response_url } = req.body;

    logInfo(LOG_MODULE, '/commands', 'Slash command received', {
      command,
      text,
      user_id,
      channel_id,
    });

    // Respond immediately (Slack needs response within 3 seconds)
    res.status(200).json({
      response_type: 'ephemeral',
      text: 'Processing your request...',
    });

    // Handle command asynchronously
    try {
      await handleSlackCommand({
        command,
        text,
        userId: user_id,
        teamId: team_id,
        channelId: channel_id,
        responseUrl: response_url,
      });
    } catch (err) {
      logError(LOG_MODULE, '/commands', 'Failed to handle Slack command', err);
      // Send error response via response_url
      // await fetch(response_url, { method: 'POST', body: JSON.stringify({ text: 'Error processing command' }) });
    }
  } catch (err) {
    logError(LOG_MODULE, '/commands', 'Slash command processing failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

/**
 * Slack Interactive Components endpoint
 * POST /api/slack/interactions
 *
 * User clicks a button, selects from dropdown, etc.
 */
router.post('/interactions', async (req: Request, res: Response) => {
  try {
    const { type, user, team, trigger_id, payload } = req.body;

    logInfo(LOG_MODULE, '/interactions', 'Slack interaction received', {
      type,
      userId: user?.id,
      triggerId: trigger_id,
    });

    // Respond immediately
    res.status(200).json({ ok: true });

    // Handle interaction asynchronously
    try {
      await handleSlackInteraction({
        type,
        userId: user?.id,
        teamId: team?.id,
        triggerId: trigger_id,
        payload,
      });
    } catch (err) {
      logError(LOG_MODULE, '/interactions', 'Failed to handle Slack interaction', err);
    }
  } catch (err) {
    logError(LOG_MODULE, '/interactions', 'Slack interaction processing failed', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;

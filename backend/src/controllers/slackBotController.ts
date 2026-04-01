import { logInfo, logError } from '../utils/logger';
import { slackBotService } from '../services/slackBotService';
import { findCompanyBySlackUserId } from '../db/companies';

const LOG_MODULE = 'slackBotController';

/**
 * Handle all Slack events (messages, app mentions, etc.)
 */
export async function handleSlackEvent(payload: any): Promise<void> {
  const { event, team_id } = payload;

  if (!event) {
    logInfo(LOG_MODULE, 'handleSlackEvent', 'No event data');
    return;
  }

  const eventType = event.type;
  const userId = event.user;
  const text = event.text;
  const channelId = event.channel;

  logInfo(LOG_MODULE, 'handleSlackEvent', `Processing ${eventType}`, {
    userId,
    channelId,
  });

  try {
    // Only process messages and app mentions
    if (eventType === 'message' || eventType === 'app_mention') {
      // Find company associated with this Slack user
      const company = await findCompanyBySlackUserId(userId);

      if (!company) {
        logInfo(LOG_MODULE, 'handleSlackEvent', 'Company not found for Slack user', { userId });
        return;
      }

      // Extract command/query from message
      let query = text || '';
      if (eventType === 'app_mention') {
        // Remove bot mention: "@RecoverAI what's the status" → "what's the status"
        query = text.replace(/<@[A-Z0-9]+>/g, '').trim();
      }

      // Route to bot service for natural language processing
      await slackBotService.processQuery({
        companyId: company.id,
        userId,
        channelId,
        query,
        source: 'message',
      });
    }
  } catch (err) {
    logError(LOG_MODULE, 'handleSlackEvent', 'Failed to process event', err);
  }
}

/**
 * Handle slash commands: /recover status
 */
export async function handleSlackCommand(payload: {
  command: string;
  text: string;
  userId: string;
  teamId: string;
  channelId: string;
  responseUrl: string;
}): Promise<void> {
  const { command, text, userId, responseUrl } = payload;

  logInfo(LOG_MODULE, 'handleSlackCommand', 'Processing slash command', {
    command,
    text,
    userId,
  });

  try {
    // Find company
    const company = await findCompanyBySlackUserId(userId);
    if (!company) {
      logInfo(LOG_MODULE, 'handleSlackCommand', 'Company not found for Slack user', { userId });
      return;
    }

    // Extract actual command from "/recover status" → "status"
    const commandText = command.replace(/^\//, '').trim();
    const fullQuery = `${commandText} ${text}`.trim();

    // Process via bot service
    await slackBotService.processQuery({
      companyId: company.id,
      userId,
      channelId: payload.channelId,
      query: fullQuery,
      source: 'slash_command',
      responseUrl, // For responding back to Slack
    });
  } catch (err) {
    logError(LOG_MODULE, 'handleSlackCommand', 'Failed to process command', err);
  }
}

/**
 * Handle interactive components (button clicks, dropdown selections, etc.)
 */
export async function handleSlackInteraction(payload: {
  type: string;
  userId?: string;
  teamId?: string;
  triggerId: string;
  payload: any;
}): Promise<void> {
  const { type, userId, payload: actionPayload } = payload;

  logInfo(LOG_MODULE, 'handleSlackInteraction', 'Processing interaction', {
    type,
    userId,
  });

  try {
    // Find company
    const company = await findCompanyBySlackUserId(userId!);
    if (!company) {
      logInfo(LOG_MODULE, 'handleSlackInteraction', 'Company not found for Slack user', { userId });
      return;
    }

    // Route based on interaction type
    if (type === 'block_actions') {
      // User clicked a button or selected from dropdown
      const action = actionPayload?.actions?.[0];
      if (action) {
        await slackBotService.handleInteraction({
          companyId: company.id,
          userId: userId!,
          actionType: action.type,
          actionValue: action.value,
          actionId: action.action_id,
        });
      }
    }
  } catch (err) {
    logError(LOG_MODULE, 'handleSlackInteraction', 'Failed to process interaction', err);
  }
}

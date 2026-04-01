import { Anthropic } from '@anthropic-ai/sdk';
import { pool } from '../config/database';
import { logInfo, logError } from '../utils/logger';
import { slackNotificationService } from './slackNotificationService';

const LOG_MODULE = 'slackBotService';
const client = new Anthropic();

/**
 * Query interface
 */
interface QueryRequest {
  companyId: string;
  userId: string;
  channelId: string;
  query: string;
  source: 'message' | 'slash_command';
  responseUrl?: string;
}

/**
 * Interaction interface
 */
interface InteractionRequest {
  companyId: string;
  userId: string;
  actionType: string;
  actionValue: string;
  actionId: string;
}

/**
 * Company AR data
 */
interface CompanyARData {
  cash_balance: number;
  total_ar: number;
  overdue_ar: number;
  days_overdue_avg: number;
  invoices_unpaid: number;
  emails_sent_week: number;
  emails_opened_week: number;
  payments_received_week: number;
  customer_count: number;
  high_risk_count: number;
}

/**
 * Fetch company's AR metrics for context
 */
async function fetchCompanyARData(companyId: string): Promise<CompanyARData> {
  const result = await pool.query(`
    SELECT
      COALESCE(co.cash_balance_usd, 0)::float AS cash_balance,
      COALESCE(SUM(i.amount)::float, 0) AS total_ar,
      COALESCE(SUM(CASE WHEN i.due_date < NOW() THEN i.amount ELSE 0 END)::float, 0) AS overdue_ar,
      COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - i.due_date)) / 86400)::int, 0) AS days_overdue_avg,
      COUNT(DISTINCT i.id)::int AS invoices_unpaid,
      COUNT(DISTINCT CASE WHEN el.sent_at > NOW() - INTERVAL '7 days' AND el.email_type LIKE 'dunning_%' THEN el.id END)::int AS emails_sent_week,
      COUNT(DISTINCT CASE WHEN el.opened_at > NOW() - INTERVAL '7 days' THEN el.id END)::int AS emails_opened_week,
      COUNT(DISTINCT CASE WHEN p.created_at > NOW() - INTERVAL '7 days' THEN p.id END)::int AS payments_received_week,
      COUNT(DISTINCT c.id)::int AS customer_count,
      COUNT(DISTINCT CASE WHEN c.risk_tier >= 3 THEN c.id END)::int AS high_risk_count
    FROM companies co
    LEFT JOIN invoices i ON i.company_id = co.id AND i.status NOT IN ('paid', 'uncollectable')
    LEFT JOIN email_logs el ON el.company_id = co.id
    LEFT JOIN payments p ON p.company_id = co.id
    LEFT JOIN customers c ON c.company_id = co.id
    WHERE co.id = $1
    GROUP BY co.id, co.cash_balance_usd
  `, [companyId]);

  if (result.rows.length === 0) {
    return {
      cash_balance: 0,
      total_ar: 0,
      overdue_ar: 0,
      days_overdue_avg: 0,
      invoices_unpaid: 0,
      emails_sent_week: 0,
      emails_opened_week: 0,
      payments_received_week: 0,
      customer_count: 0,
      high_risk_count: 0,
    };
  }

  return result.rows[0];
}

/**
 * Parse intent and extract entities from natural language
 * Uses Claude API to understand what the user is asking
 */
async function parseIntent(query: string, arData: CompanyARData): Promise<{
  intent: string;
  parameters: Record<string, any>;
  response: string;
  confidence?: number;
}> {
  const systemPrompt = `You are RecoverAI's Slack bot. You help founders understand their AR (accounts receivable) situation.

Available data:
- Cash balance: $${arData.cash_balance.toLocaleString()}
- Total unpaid AR: $${arData.total_ar.toLocaleString()}
- Overdue AR: $${arData.overdue_ar.toLocaleString()}
- Unpaid invoices: ${arData.invoices_unpaid}
- High-risk customers: ${arData.high_risk_count}
- This week: ${arData.emails_sent_week} dunning emails, ${arData.emails_opened_week} opened, $${arData.payments_received_week} recovered

You understand these intents:
1. STATUS - ask about current cash/AR situation
2. CUSTOMER - ask about specific customer
3. FORECAST - ask about expected payments or trends
4. CONTROL - pause/resume dunning
5. METRICS - ask about effectiveness (conversion rates, open rates)
6. HELP - user doesn't know what to ask

Respond with JSON:
{
  "intent": "STATUS|CUSTOMER|FORECAST|CONTROL|METRICS|HELP",
  "confidence": 0.0-1.0,
  "parameters": { "key": "value" },
  "response": "Human-friendly response"
}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: query,
      },
    ],
  });

  try {
    const content = message.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    logError(LOG_MODULE, 'parseIntent', 'Failed to parse Claude response', err);
  }

  return {
    intent: 'HELP',
    parameters: {},
    response: 'Sorry, I did not understand your question. Try asking about your cash situation, customers, or payments.',
  };
}

/**
 * Process a natural language query from the user
 */
export const slackBotService = {
  async processQuery(request: QueryRequest): Promise<void> {
    const { companyId, userId, channelId, query, responseUrl } = request;

    logInfo(LOG_MODULE, 'processQuery', 'Processing natural language query', {
      companyId,
      userId,
      query: query.substring(0, 100),
    });

    try {
      // Fetch company's AR data for context
      const arData = await fetchCompanyARData(companyId);

      // Parse intent using Claude
      const result = await parseIntent(query, arData);

      logInfo(LOG_MODULE, 'processQuery', 'Intent parsed', {
        intent: result.intent,
        confidence: result.confidence,
      });

      // Send response back to Slack
      await slackNotificationService.postMessage({
        companyId,
        channelId,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: result.response,
            },
          },
        ],
      });

      // Log interaction for learning (future phase)
      // TODO: Save to company_learnings table
    } catch (err) {
      logError(LOG_MODULE, 'processQuery', 'Failed to process query', err);

      await slackNotificationService.postMessage({
        companyId,
        channelId,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ Something went wrong processing your request.',
            },
          },
        ],
      });
    }
  },

  /**
   * Handle interactive button clicks
   */
  async handleInteraction(request: InteractionRequest): Promise<void> {
    const { companyId, userId, actionId, actionValue } = request;

    logInfo(LOG_MODULE, 'handleInteraction', 'Processing interaction', {
      companyId,
      actionId,
      actionValue: actionValue?.substring(0, 50),
    });

    try {
      // Route based on action
      if (actionId === 'pause_dunning') {
        // TODO: Pause dunning for customer or globally
        logInfo(LOG_MODULE, 'handleInteraction', 'Pause dunning action', { customerId: actionValue });
      } else if (actionId === 'resume_dunning') {
        // TODO: Resume dunning
        logInfo(LOG_MODULE, 'handleInteraction', 'Resume dunning action', { customerId: actionValue });
      } else if (actionId === 'view_dashboard') {
        // Just notify
        logInfo(LOG_MODULE, 'handleInteraction', 'View dashboard action');
      }
    } catch (err) {
      logError(LOG_MODULE, 'handleInteraction', 'Failed to handle interaction', err);
    }
  },
};

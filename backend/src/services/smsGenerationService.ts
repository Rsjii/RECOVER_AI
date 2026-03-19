import { Anthropic } from '@anthropic-ai/sdk';
import { config } from '../config/env';
import { logInfo, logError } from '../utils/logger';

const LOG_MODULE = 'smsGenerationService';
const MAX_SMS_LENGTH = 160;

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

export interface GenerateSMSParams {
  customerName: string;
  companyName: string;      // The RecoverAI customer's company name (sender)
  invoiceAmount: number;
  daysOverdue: number;
}

/**
 * Generate a personalized SMS collection message using Claude.
 * Falls back to template if AI fails.
 * Always returns a string <= 160 characters.
 */
export async function generateSMSMessage(params: GenerateSMSParams): Promise<string> {
  const { customerName, companyName, invoiceAmount, daysOverdue } = params;
  const firstName = customerName.split(' ')[0];

  try {
    const prompt = `Write a short, professional SMS payment reminder. Max 155 characters total (must fit in one SMS).

Details:
- Customer first name: ${firstName}
- Sender company: ${companyName}
- Invoice amount: $${invoiceAmount.toLocaleString()}
- Days overdue: ${daysOverdue}

Rules:
- Be polite but direct
- Include the amount
- Ask them to reply or call
- End with "Reply STOP to opt out"
- MUST be under 155 characters including "Reply STOP to opt out"

Output ONLY the SMS text, nothing else.`;

    const response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    if (text && text.length <= MAX_SMS_LENGTH) {
      logInfo(LOG_MODULE, 'generateSMSMessage', 'SMS generated', { length: text.length });
      return text;
    }

    // Truncate if over limit
    if (text) {
      return text.slice(0, MAX_SMS_LENGTH - 3) + '...';
    }
  } catch (error) {
    logError(LOG_MODULE, 'generateSMSMessage', 'AI generation failed, using template', error);
  }

  // Fallback template
  return buildFallbackSMS(firstName, companyName, invoiceAmount, daysOverdue);
}

function buildFallbackSMS(
  firstName: string,
  companyName: string,
  amount: number,
  daysOverdue: number
): string {
  const urgency = daysOverdue > 30 ? 'urgently' : 'now';
  const base = `Hi ${firstName}, your $${amount.toLocaleString()} invoice to ${companyName} is ${daysOverdue}d overdue. Please pay ${urgency}. Reply STOP to opt out.`;
  return base.length <= MAX_SMS_LENGTH ? base : `Hi ${firstName}, invoice $${amount.toLocaleString()} overdue ${daysOverdue}d. Please pay now. Reply STOP to opt out.`;
}

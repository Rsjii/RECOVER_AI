import { Anthropic } from '@anthropic-ai/sdk';
import axios from 'axios';
import { config } from '../config/env';
import {
  RiskScoreInput,
  RiskScoreResponse,
  DunningEmailGenerationInput,
  DunningEmailResponse,
  PaymentPlanRecommendationInput,
  PaymentPlanRecommendationResponse,
  CustomerPaymentHistory,
  PaymentPlanTerms,
} from '../types/ai';
import { pool } from '../config/database';
import { logError as baseLogError, logInfo as baseLogInfo, logWarn as baseLogWarn } from '../utils/logger';
import { upsertApiUsage } from '../db/apiUsage';

// ============ Types ============
type AIProvider = 'anthropic' | 'openai';

interface ProviderSelection {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

const AI_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'claude-3-5-sonnet': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-haiku':      { inputPer1M: 0.25, outputPer1M: 1.25  },
  'gpt-4o-mini':       { inputPer1M: 0.15, outputPer1M: 0.60  },
  'gpt-4o':            { inputPer1M: 5.00, outputPer1M: 15.00 },
};

function calculateAICost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = Object.entries(AI_PRICING).find(([key]) => model.includes(key))?.[1]
    ?? { inputPer1M: 3.00, outputPer1M: 15.00 };
  return (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M;
}

// ============ Structured Logger ============
const LOG_MODULE = 'AIService';

function logInfo(method: string, msg: string, data?: Record<string, unknown>): void {
  baseLogInfo(LOG_MODULE, method, msg, data);
}

function logError(method: string, msg: string, error?: unknown): void {
  baseLogError(LOG_MODULE, method, msg, error);
}

function logWarn(method: string, msg: string, data?: Record<string, unknown>): void {
  baseLogWarn(LOG_MODULE, method, msg, data);
}

// ============ AI Service ============
class AIService {
  /**
   * Detect which AI provider to use based on available API keys.
   * Priority: Anthropic (if valid key) → OpenAI (explicit or fallback) → Error
   */
  private getProviderSelection(): ProviderSelection {
    const anthropicKey = config.anthropic.apiKey?.trim();
    const openAIKeyFromEnv = config.openai.apiKey?.trim();

    // Detect if ANTHROPIC_API_KEY is actually an OpenAI-style key
    const anthropicLooksLikeOpenAI =
      !!anthropicKey &&
      (anthropicKey.startsWith('sk-proj-') ||
        (anthropicKey.startsWith('sk-') && !anthropicKey.startsWith('sk-ant-')));

    // Prefer Anthropic if valid key present
    if (anthropicKey && !anthropicLooksLikeOpenAI) {
      logInfo('getProviderSelection', 'Using Anthropic provider', { model: config.anthropic.model });
      return { provider: 'anthropic', apiKey: anthropicKey, model: config.anthropic.model };
    }

    // Fallback to OpenAI (explicit OPENAI_API_KEY or detected from ANTHROPIC_API_KEY)
    const openAIKey = openAIKeyFromEnv || (anthropicLooksLikeOpenAI ? anthropicKey : undefined);
    if (openAIKey) {
      logInfo('getProviderSelection', 'Using OpenAI provider (fallback)', { model: config.openai.model });
      return { provider: 'openai', apiKey: openAIKey, model: config.openai.model };
    }

    throw new Error('No valid AI API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env');
  }

  /**
   * Extract and parse JSON object from AI model text response.
   * Handles markdown code fences, extra whitespace, etc.
   */
  private parseJsonFromModelResponse(responseText: string): Record<string, unknown> {
    if (!responseText || !responseText.trim()) {
      throw new Error('Empty response from AI provider');
    }

    // Strip markdown code fences if present
    let cleaned = responseText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logError('parseJson', 'No JSON object found in response', new Error(cleaned.slice(0, 300)));
      throw new Error('AI provider returned non-JSON response');
    }

    try {
      return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch (parseError) {
      logError('parseJson', 'JSON.parse failed on extracted text', parseError);
      throw new Error(`Failed to parse AI JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  }

  /**
   * Send prompt to AI provider and return parsed JSON.
   * Handles Anthropic Messages API and OpenAI Chat Completions API.
   */
  private async generateJsonResponse(prompt: string, maxTokens: number, companyId?: string): Promise<Record<string, unknown>> {
    const startTime = Date.now();
    const selection = this.getProviderSelection();

    try {
      let responseText = '';

      if (selection.provider === 'anthropic') {
        const anthropic = new Anthropic({ apiKey: selection.apiKey });
        logInfo('generateJsonResponse', 'Calling Anthropic API', { model: selection.model, maxTokens });

        const message = await anthropic.messages.create({
          model: selection.model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        });

        const textBlock = message.content.find((block) => block.type === 'text');
        responseText = textBlock?.type === 'text' ? textBlock.text : '';

        if (companyId && message.usage) {
          const inputTokens = message.usage.input_tokens ?? 0;
          const outputTokens = message.usage.output_tokens ?? 0;
          const costUsd = calculateAICost(selection.model, inputTokens, outputTokens);
          upsertApiUsage({ companyId, service: 'claude', model: selection.model, usageCount: 1, costUsd, inputTokens, outputTokens, period: new Date() })
            .catch(err => logError('generateJsonResponse', 'Failed to track Claude usage', err));
        }
      } else {
        logInfo('generateJsonResponse', 'Calling OpenAI API', { model: selection.model, maxTokens });

        const response = await axios.post<OpenAIChatResponse>(
          'https://api.openai.com/v1/chat/completions',
          {
            model: selection.model,
            temperature: 0.2,
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: 'Return valid JSON only. No markdown, no extra text.' },
              { role: 'user', content: prompt },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${selection.apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 60_000,
          }
        );

        responseText = response.data.choices?.[0]?.message?.content || '';

        if (companyId && response.data.usage) {
          const inputTokens = response.data.usage.prompt_tokens ?? 0;
          const outputTokens = response.data.usage.completion_tokens ?? 0;
          const costUsd = calculateAICost(selection.model, inputTokens, outputTokens);
          upsertApiUsage({ companyId, service: 'openai', model: selection.model, usageCount: 1, costUsd, inputTokens, outputTokens, period: new Date() })
            .catch(err => logError('generateJsonResponse', 'Failed to track OpenAI usage', err));
        }
      }

      const elapsed = Date.now() - startTime;
      logInfo('generateJsonResponse', `AI response received`, {
        provider: selection.provider,
        model: selection.model,
        elapsedMs: elapsed,
        responseLength: responseText.length,
      });

      return this.parseJsonFromModelResponse(responseText);
    } catch (error) {
      const elapsed = Date.now() - startTime;
      logError('generateJsonResponse', `Provider ${selection.provider} failed after ${elapsed}ms`, error);
      throw new Error(
        `AI provider (${selection.provider}) failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Fetch customer payment history from database.
   * JOINs payments → invoices (payments table has no customer_id column).
   * Computes days_late and days_to_pay from timestamps.
   */
  private async getCustomerPaymentHistory(customerId: string): Promise<CustomerPaymentHistory> {
    const method = 'getCustomerPaymentHistory';
    logInfo(method, 'Fetching payment history from DB', { customerId });

    try {
      // ── Invoice aggregates ──
      const invoiceResult = await pool.query(
        `SELECT
          COUNT(*)::int as total_invoices,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_paid,
          COALESCE(SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END), 0) as total_outstanding
        FROM invoices
        WHERE customer_id = $1`,
        [customerId]
      );

      const inv = invoiceResult.rows[0] || { total_invoices: 0, total_paid: 0, total_outstanding: 0 };

      // ── Payment aggregates (JOIN invoices to derive customer_id + timing) ──
      const paymentResult = await pool.query(
        `SELECT
          COUNT(p.id)::int as total_payments,
          COALESCE(SUM(CASE WHEN p.paid_at <= i.due_date THEN 1 ELSE 0 END), 0)::int as on_time_payments,
          COALESCE(SUM(CASE WHEN p.paid_at > i.due_date THEN 1 ELSE 0 END), 0)::int as late_payments,
          COALESCE(AVG(
            CASE WHEN p.paid_at > i.due_date
            THEN EXTRACT(EPOCH FROM (p.paid_at - i.due_date)) / 86400.0
            ELSE NULL END
          ), 0) as avg_days_late,
          MAX(p.paid_at)::text as last_payment_date,
          COALESCE(AVG(
            EXTRACT(EPOCH FROM (p.paid_at - i.issued_date)) / 86400.0
          ), 0) as avg_payment_days
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        WHERE i.customer_id = $1`,
        [customerId]
      );

      const pay = paymentResult.rows[0] || {
        total_payments: 0,
        on_time_payments: 0,
        late_payments: 0,
        avg_days_late: 0,
        last_payment_date: null,
        avg_payment_days: 0,
      };

      const totalPayments = Number(pay.total_payments);
      const onTimeRate = totalPayments > 0
        ? (Number(pay.on_time_payments) / totalPayments) * 100
        : 0;

      const history: CustomerPaymentHistory = {
        totalInvoices: Number(inv.total_invoices),
        totalPaid: Number(inv.total_paid),
        totalOutstanding: Number(inv.total_outstanding),
        onTimePayments: Number(pay.on_time_payments),
        latePayments: Number(pay.late_payments),
        averageDaysLate: Math.round(Number(pay.avg_days_late) * 100) / 100,
        onTimeRate: Math.round(onTimeRate * 100) / 100,
        lastPaymentDate: pay.last_payment_date || undefined,
        avgPaymentDays: Math.round(Number(pay.avg_payment_days) * 100) / 100,
      };

      logInfo(method, 'Payment history fetched', {
        customerId,
        totalInvoices: history.totalInvoices,
        totalPayments,
        onTimeRate: history.onTimeRate,
      });

      return history;
    } catch (error) {
      logError(method, 'DB query failed — returning empty defaults', error);
      return {
        totalInvoices: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        onTimePayments: 0,
        latePayments: 0,
        averageDaysLate: 0,
        onTimeRate: 0,
        lastPaymentDate: undefined,
        avgPaymentDays: 0,
      };
    }
  }

  // ================================================================
  // PUBLIC METHODS
  // ================================================================

  /**
   * Calculate risk score for a customer using AI analysis of payment history.
   */
  async calculateRiskScore(input: RiskScoreInput, companyId?: string): Promise<RiskScoreResponse> {
    const method = 'calculateRiskScore';
    const startTime = Date.now();
    logInfo(method, 'Starting', { customerId: input.customerId, invoiceId: input.invoiceId });

    try {
      const paymentHistory = await this.getCustomerPaymentHistory(input.customerId);

      const prompt = `You are a credit risk analyst. Analyze this customer's payment history and provide a risk score.

Customer Payment History:
- Total Invoices: ${paymentHistory.totalInvoices}
- Total Paid: $${paymentHistory.totalPaid}
- Total Outstanding: $${paymentHistory.totalOutstanding}
- On-Time Payments: ${paymentHistory.onTimePayments} (${paymentHistory.onTimeRate}%)
- Late Payments: ${paymentHistory.latePayments}
- Average Days Late: ${paymentHistory.averageDaysLate} days
- Last Payment: ${paymentHistory.lastPaymentDate || 'Never'}
- Average Payment Time: ${paymentHistory.avgPaymentDays} days

Provide your analysis in the following JSON format ONLY:
{
  "riskScore": <number 0-100>,
  "riskLevel": "<LOW|MEDIUM|HIGH|CRITICAL>",
  "reasoning": "<brief explanation of the score>",
  "recommendations": ["<recommendation 1>", "<recommendation 2>"],
  "confidenceScore": <number 0-100>
}

Do not include any text outside the JSON.`;

      const analysis = await this.generateJsonResponse(prompt, 1024, companyId);

      const result: RiskScoreResponse = {
        customerId: input.customerId,
        riskScore: Number(analysis.riskScore ?? 50),
        riskLevel: (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(analysis.riskLevel))
          ? String(analysis.riskLevel)
          : 'MEDIUM') as RiskScoreResponse['riskLevel'],
        reasoning: String(analysis.reasoning || 'No reasoning provided'),
        paymentHistory,
        recommendations: Array.isArray(analysis.recommendations)
          ? (analysis.recommendations as string[])
          : [],
        confidenceScore: Number(analysis.confidenceScore ?? 50),
      };

      const elapsed = Date.now() - startTime;
      logInfo(method, `Completed in ${elapsed}ms`, {
        customerId: input.customerId,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        confidenceScore: result.confidenceScore,
      });

      return result;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      logError(method, `Failed after ${elapsed}ms`, error);
      throw new Error(`Failed to calculate risk score: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a personalized dunning email using AI.
   * Tone is auto-selected based on daysOverdue.
   */
  async generateDunningEmail(input: DunningEmailGenerationInput, companyId?: string): Promise<DunningEmailResponse> {
    const method = 'generateDunningEmail';
    const startTime = Date.now();
    logInfo(method, 'Starting', {
      customerId: input.customerId,
      invoiceId: input.invoiceId,
      daysOverdue: input.daysOverdue,
      emailType: input.emailType,
    });

    try {
      // Helper to describe email stage
      const emailStageContext = (emailType?: string): string => {
        const map: Record<string, string> = {
          dunning_1: 'First contact — customer may have overlooked invoice, keep friendly',
          dunning_2: 'Second reminder — gentle escalation, note the delay',
          dunning_3: 'Third reminder — firmer tone, mention next steps if unpaid',
          dunning_4: 'Fourth notice — serious, mention consequences or collections',
          dunning_5: 'Final notice — last attempt before escalation to legal/collections',
          final_notice: 'Final notice — last attempt before escalation to legal/collections',
          payment_plan_offer: 'Offering flexible payment plan — empathetic, solution-focused',
        };
        return map[emailType || ''] || 'Standard payment reminder';
      };

      const tone =
        input.daysOverdue > 60
          ? 'urgent'
          : input.daysOverdue > 30
            ? 'firm'
            : 'friendly';

      // Fetch company to get dunning sender name
      let senderName = 'Collections Team';
      if (companyId) {
        try {
          const companyResult = await pool.query(
            'SELECT dunning_sender_name FROM companies WHERE id = $1',
            [companyId]
          );
          if (companyResult.rows[0]?.dunning_sender_name) {
            senderName = companyResult.rows[0].dunning_sender_name;
          }
        } catch (err) {
          logWarn(method, 'Failed to fetch dunning sender name, using default', { companyId });
        }
      }

      const prompt = `You are an expert dunning email writer for collections. Generate a professional, personalized dunning email.

Context:
- Customer Name: ${input.customerName}
- Company Name: ${input.companyName}
- Invoice Amount: $${input.invoiceAmount}
- Due Date: ${input.dueDate}
- Days Overdue: ${input.daysOverdue}
- Email Stage: ${input.emailType || 'dunning_1'} — Attempt ${(input.previousReminders || 0) + 1} of 5
- Stage Context: ${emailStageContext(input.emailType)}
- Risk Score: ${input.riskScore || 'N/A'}
- Previous Reminders: ${input.previousReminders || 0}
- Payment Link: ${input.paymentLink || 'N/A'}
- Email Signature: Best regards,\n${senderName}

Tone: ${tone}
${tone === 'urgent' ? 'The customer is significantly late. Be firm but professional.' : tone === 'firm' ? 'The customer is moderately late. Be direct but courteous.' : 'This is an early reminder. Be friendly and helpful.'}

Generate a dunning email in JSON format ONLY:
{
  "subject": "<email subject line>",
  "bodyText": "<plain text body>",
  "bodyHtml": "<HTML body with basic formatting>",
  "tone": "<friendly|firm|urgent>",
  "estimatedOpenRate": <number 0-100>,
  "personalizedElements": ["<element 1>", "<element 2>"]
}

Do not include any text outside the JSON. Keep the email professional and concise.`;

      const emailContent = await this.generateJsonResponse(prompt, 2048, companyId);

      const result: DunningEmailResponse = {
        subject: String(emailContent.subject || 'Payment Reminder'),
        bodyText: String(emailContent.bodyText || ''),
        bodyHtml: String(emailContent.bodyHtml || ''),
        tone: (['friendly', 'firm', 'urgent'].includes(String(emailContent.tone))
          ? String(emailContent.tone)
          : tone) as DunningEmailResponse['tone'],
        estimatedOpenRate: Number(emailContent.estimatedOpenRate ?? 0),
        personalizedElements: Array.isArray(emailContent.personalizedElements)
          ? (emailContent.personalizedElements as string[])
          : [],
      };

      const elapsed = Date.now() - startTime;
      logInfo(method, `Completed in ${elapsed}ms`, {
        customerId: input.customerId,
        invoiceId: input.invoiceId,
        tone: result.tone,
        subjectLength: result.subject.length,
      });

      return result;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      logError(method, `Failed after ${elapsed}ms`, error);
      throw new Error(`Failed to generate email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Recommend payment plan terms using AI.
   * Fetches customer history from DB if not provided.
   */
  async recommendPaymentPlan(
    input: PaymentPlanRecommendationInput,
    companyId?: string
  ): Promise<PaymentPlanRecommendationResponse> {
    const method = 'recommendPaymentPlan';
    const startTime = Date.now();
    logInfo(method, 'Starting', {
      customerId: input.customerId,
      invoiceId: input.invoiceId,
      invoiceAmount: input.invoiceAmount,
      daysOverdue: input.daysOverdue,
    });

    try {
      const history =
        input.customerPaymentHistory ||
        (await this.getCustomerPaymentHistory(input.customerId));

      const maxDays = input.maxDurationDays || 90;

      const prompt = `You are a payment plan specialist. Recommend installment payment terms for an overdue invoice.

Invoice Details:
- Invoice Amount: $${input.invoiceAmount}
- Days Overdue: ${input.daysOverdue}
- Max Duration: ${maxDays} days
- Risk Score: ${input.riskScore || 'N/A'}

Customer Payment History:
- Total Paid: $${history.totalPaid}
- On-Time Rate: ${history.onTimeRate}%
- Average Days Late: ${history.averageDaysLate}
- Total Outstanding: $${history.totalOutstanding}

Recommend a primary payment plan and 2 alternatives. Each plan should include:
- Installment count
- Installment amount
- First payment date (days from today)
- Frequency (days between payments)
- Down payment percentage

Consider the risk score and payment history when recommending frequency and down payment.

Respond in JSON format ONLY:
{
  "recommendedPlan": {
    "installmentCount": <number>,
    "installmentAmount": <number>,
    "firstPaymentDate": "<YYYY-MM-DD>",
    "frequencyDays": <number>,
    "downPaymentPercentage": <number 0-100>
  },
  "alternativePlans": [
    { "installmentCount": <number>, "installmentAmount": <number>, "firstPaymentDate": "<YYYY-MM-DD>", "frequencyDays": <number>, "downPaymentPercentage": <number> },
    { "installmentCount": <number>, "installmentAmount": <number>, "firstPaymentDate": "<YYYY-MM-DD>", "frequencyDays": <number>, "downPaymentPercentage": <number> }
  ],
  "reasoning": "<explanation of why this plan is recommended>",
  "successProbability": <number 0-100>,
  "riskAssessment": "<brief risk analysis>"
}

Do not include any text outside the JSON. Ensure math is correct: total installments = installmentCount * installmentAmount + (downPayment).`;

      const recommendation = await this.generateJsonResponse(prompt, 2048, companyId);

      const defaultPlan: PaymentPlanTerms = {
        installmentCount: 1,
        installmentAmount: input.invoiceAmount,
        firstPaymentDate: new Date().toISOString().slice(0, 10),
        frequencyDays: 30,
        downPaymentPercentage: 0,
      };

      const result: PaymentPlanRecommendationResponse = {
        customerId: input.customerId,
        invoiceId: input.invoiceId,
        recommendedPlan: (recommendation.recommendedPlan as PaymentPlanTerms) || defaultPlan,
        alternativePlans: Array.isArray(recommendation.alternativePlans)
          ? (recommendation.alternativePlans as PaymentPlanTerms[])
          : [],
        reasoning: String(recommendation.reasoning || 'No reasoning provided'),
        successProbability: Number(recommendation.successProbability ?? 50),
        riskAssessment: String(recommendation.riskAssessment || 'No assessment provided'),
      };

      const elapsed = Date.now() - startTime;
      logInfo(method, `Completed in ${elapsed}ms`, {
        customerId: input.customerId,
        invoiceId: input.invoiceId,
        installmentCount: result.recommendedPlan.installmentCount,
        successProbability: result.successProbability,
      });

      return result;
    } catch (error) {
      const elapsed = Date.now() - startTime;
      logError(method, `Failed after ${elapsed}ms`, error);
      throw new Error(
        `Failed to recommend payment plan: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default new AIService();

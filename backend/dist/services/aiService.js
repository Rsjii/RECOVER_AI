"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@anthropic-ai/sdk");
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
// ============ Structured Logger ============
const LOG_MODULE = 'AIService';
function logInfo(method, msg, data) {
    (0, logger_1.logInfo)(LOG_MODULE, method, msg, data);
}
function logError(method, msg, error) {
    (0, logger_1.logError)(LOG_MODULE, method, msg, error);
}
function logWarn(method, msg, data) {
    (0, logger_1.logWarn)(LOG_MODULE, method, msg, data);
}
// ============ AI Service ============
class AIService {
    /**
     * Detect which AI provider to use based on available API keys.
     * Priority: Anthropic (if valid key) → OpenAI (explicit or fallback) → Error
     */
    getProviderSelection() {
        const anthropicKey = env_1.config.anthropic.apiKey?.trim();
        const openAIKeyFromEnv = env_1.config.openai.apiKey?.trim();
        // Detect if ANTHROPIC_API_KEY is actually an OpenAI-style key
        const anthropicLooksLikeOpenAI = !!anthropicKey &&
            (anthropicKey.startsWith('sk-proj-') ||
                (anthropicKey.startsWith('sk-') && !anthropicKey.startsWith('sk-ant-')));
        // Prefer Anthropic if valid key present
        if (anthropicKey && !anthropicLooksLikeOpenAI) {
            logInfo('getProviderSelection', 'Using Anthropic provider', { model: env_1.config.anthropic.model });
            return { provider: 'anthropic', apiKey: anthropicKey, model: env_1.config.anthropic.model };
        }
        // Fallback to OpenAI (explicit OPENAI_API_KEY or detected from ANTHROPIC_API_KEY)
        const openAIKey = openAIKeyFromEnv || (anthropicLooksLikeOpenAI ? anthropicKey : undefined);
        if (openAIKey) {
            logInfo('getProviderSelection', 'Using OpenAI provider (fallback)', { model: env_1.config.openai.model });
            return { provider: 'openai', apiKey: openAIKey, model: env_1.config.openai.model };
        }
        throw new Error('No valid AI API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env');
    }
    /**
     * Extract and parse JSON object from AI model text response.
     * Handles markdown code fences, extra whitespace, etc.
     */
    parseJsonFromModelResponse(responseText) {
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
            return JSON.parse(jsonMatch[0]);
        }
        catch (parseError) {
            logError('parseJson', 'JSON.parse failed on extracted text', parseError);
            throw new Error(`Failed to parse AI JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
    }
    /**
     * Send prompt to AI provider and return parsed JSON.
     * Handles Anthropic Messages API and OpenAI Chat Completions API.
     */
    async generateJsonResponse(prompt, maxTokens) {
        const startTime = Date.now();
        const selection = this.getProviderSelection();
        try {
            let responseText = '';
            if (selection.provider === 'anthropic') {
                const anthropic = new sdk_1.Anthropic({ apiKey: selection.apiKey });
                logInfo('generateJsonResponse', 'Calling Anthropic API', { model: selection.model, maxTokens });
                const message = await anthropic.messages.create({
                    model: selection.model,
                    max_tokens: maxTokens,
                    messages: [{ role: 'user', content: prompt }],
                });
                const textBlock = message.content.find((block) => block.type === 'text');
                responseText = textBlock?.type === 'text' ? textBlock.text : '';
            }
            else {
                logInfo('generateJsonResponse', 'Calling OpenAI API', { model: selection.model, maxTokens });
                const response = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                    model: selection.model,
                    temperature: 0.2,
                    max_tokens: maxTokens,
                    messages: [
                        { role: 'system', content: 'Return valid JSON only. No markdown, no extra text.' },
                        { role: 'user', content: prompt },
                    ],
                }, {
                    headers: {
                        Authorization: `Bearer ${selection.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: 60000,
                });
                responseText = response.data.choices?.[0]?.message?.content || '';
            }
            const elapsed = Date.now() - startTime;
            logInfo('generateJsonResponse', `AI response received`, {
                provider: selection.provider,
                model: selection.model,
                elapsedMs: elapsed,
                responseLength: responseText.length,
            });
            return this.parseJsonFromModelResponse(responseText);
        }
        catch (error) {
            const elapsed = Date.now() - startTime;
            logError('generateJsonResponse', `Provider ${selection.provider} failed after ${elapsed}ms`, error);
            throw new Error(`AI provider (${selection.provider}) failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Fetch customer payment history from database.
     * JOINs payments → invoices (payments table has no customer_id column).
     * Computes days_late and days_to_pay from timestamps.
     */
    async getCustomerPaymentHistory(customerId) {
        const method = 'getCustomerPaymentHistory';
        logInfo(method, 'Fetching payment history from DB', { customerId });
        try {
            // ── Invoice aggregates ──
            const invoiceResult = await database_1.pool.query(`SELECT
          COUNT(*)::int as total_invoices,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_paid,
          COALESCE(SUM(CASE WHEN status != 'paid' THEN amount ELSE 0 END), 0) as total_outstanding
        FROM invoices
        WHERE customer_id = $1`, [customerId]);
            const inv = invoiceResult.rows[0] || { total_invoices: 0, total_paid: 0, total_outstanding: 0 };
            // ── Payment aggregates (JOIN invoices to derive customer_id + timing) ──
            const paymentResult = await database_1.pool.query(`SELECT
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
        WHERE i.customer_id = $1`, [customerId]);
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
            const history = {
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
        }
        catch (error) {
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
    async calculateRiskScore(input) {
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
            const analysis = await this.generateJsonResponse(prompt, 1024);
            const result = {
                customerId: input.customerId,
                riskScore: Number(analysis.riskScore ?? 50),
                riskLevel: (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(analysis.riskLevel))
                    ? String(analysis.riskLevel)
                    : 'MEDIUM'),
                reasoning: String(analysis.reasoning || 'No reasoning provided'),
                paymentHistory,
                recommendations: Array.isArray(analysis.recommendations)
                    ? analysis.recommendations
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
        }
        catch (error) {
            const elapsed = Date.now() - startTime;
            logError(method, `Failed after ${elapsed}ms`, error);
            throw new Error(`Failed to calculate risk score: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Generate a personalized dunning email using AI.
     * Tone is auto-selected based on daysOverdue.
     */
    async generateDunningEmail(input) {
        const method = 'generateDunningEmail';
        const startTime = Date.now();
        logInfo(method, 'Starting', {
            customerId: input.customerId,
            invoiceId: input.invoiceId,
            daysOverdue: input.daysOverdue,
        });
        try {
            const tone = input.daysOverdue > 60
                ? 'urgent'
                : input.daysOverdue > 30
                    ? 'firm'
                    : 'friendly';
            const prompt = `You are an expert dunning email writer for collections. Generate a professional, personalized dunning email.

Context:
- Customer Name: ${input.customerName}
- Company Name: ${input.companyName}
- Invoice Amount: $${input.invoiceAmount}
- Due Date: ${input.dueDate}
- Days Overdue: ${input.daysOverdue}
- Risk Score: ${input.riskScore || 'N/A'}
- Previous Reminders: ${input.previousReminders || 0}
- Payment Link: ${input.paymentLink || 'N/A'}

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
            const emailContent = await this.generateJsonResponse(prompt, 2048);
            const result = {
                subject: String(emailContent.subject || 'Payment Reminder'),
                bodyText: String(emailContent.bodyText || ''),
                bodyHtml: String(emailContent.bodyHtml || ''),
                tone: (['friendly', 'firm', 'urgent'].includes(String(emailContent.tone))
                    ? String(emailContent.tone)
                    : tone),
                estimatedOpenRate: Number(emailContent.estimatedOpenRate ?? 0),
                personalizedElements: Array.isArray(emailContent.personalizedElements)
                    ? emailContent.personalizedElements
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
        }
        catch (error) {
            const elapsed = Date.now() - startTime;
            logError(method, `Failed after ${elapsed}ms`, error);
            throw new Error(`Failed to generate email: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Recommend payment plan terms using AI.
     * Fetches customer history from DB if not provided.
     */
    async recommendPaymentPlan(input) {
        const method = 'recommendPaymentPlan';
        const startTime = Date.now();
        logInfo(method, 'Starting', {
            customerId: input.customerId,
            invoiceId: input.invoiceId,
            invoiceAmount: input.invoiceAmount,
            daysOverdue: input.daysOverdue,
        });
        try {
            const history = input.customerPaymentHistory ||
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
            const recommendation = await this.generateJsonResponse(prompt, 2048);
            const defaultPlan = {
                installmentCount: 1,
                installmentAmount: input.invoiceAmount,
                firstPaymentDate: new Date().toISOString().slice(0, 10),
                frequencyDays: 30,
                downPaymentPercentage: 0,
            };
            const result = {
                customerId: input.customerId,
                invoiceId: input.invoiceId,
                recommendedPlan: recommendation.recommendedPlan || defaultPlan,
                alternativePlans: Array.isArray(recommendation.alternativePlans)
                    ? recommendation.alternativePlans
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
        }
        catch (error) {
            const elapsed = Date.now() - startTime;
            logError(method, `Failed after ${elapsed}ms`, error);
            throw new Error(`Failed to recommend payment plan: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
exports.default = new AIService();

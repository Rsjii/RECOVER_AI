import { pool } from '../config/database';
import { logError, logInfo } from '../utils/logger';

const LOG_MODULE = 'agentDecisions';

export interface AgentDecisionLog {
  companyId: string;
  invoiceId?: string;
  customerId?: string;
  decisionType: 'email_queued' | 'email_sent' | 'skipped' | 'paused' | 'plan_created' | 'sms_queued' | 'unreachable';
  emailType?: string;
  pilotMode?: string;
  daysOverdue?: number;
  riskScore?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an agent decision to the agent_decisions table.
 * Fire-and-forget: swallows all errors to avoid disrupting main email flow.
 * Used for building learning system in Month 2+.
 */
export async function logAgentDecision(input: AgentDecisionLog): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO agent_decisions
       (company_id, invoice_id, customer_id, decision_type, email_type, pilot_mode, days_overdue, risk_score, reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        input.companyId,
        input.invoiceId || null,
        input.customerId || null,
        input.decisionType,
        input.emailType || null,
        input.pilotMode || null,
        input.daysOverdue || null,
        input.riskScore || null,
        input.reason || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    logInfo(LOG_MODULE, 'logAgentDecision', 'Decision logged', {
      companyId: input.companyId,
      invoiceId: input.invoiceId,
      decisionType: input.decisionType,
    });
  } catch (error) {
    // Non-critical: log error but don't throw
    logError(LOG_MODULE, 'logAgentDecision', 'Failed to log agent decision (non-blocking)', error);
  }
}

export async function listAgentDecisionsByInvoice(invoiceId: string, companyId: string, limit = 10): Promise<any[]> {
  const result = await pool.query(
    `SELECT * FROM agent_decisions
     WHERE company_id = $1 AND invoice_id = $2
     ORDER BY decided_at DESC
     LIMIT $3`,
    [companyId, invoiceId, limit]
  );
  return result.rows;
}

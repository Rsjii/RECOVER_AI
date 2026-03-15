import { Request, Response } from 'express';
import { pool } from '../config/database';
import * as AuditDB from '../db/auditLogs';
import * as PolicyApprovalsDB from '../db/policyApprovals';
import { logError } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'policyController';

type AutonomyLevel = 'autonomous' | 'assisted' | 'manual';

interface PolicySettings {
  autonomyLevel: AutonomyLevel;
  maxEmailsPerWeek: number;
  requireApprovalForHighRisk: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  escalationDays: number;
}

const DEFAULT_POLICY: PolicySettings = {
  autonomyLevel: 'autonomous',
  maxEmailsPerWeek: 5,
  requireApprovalForHighRisk: true,
  quietHoursStart: 20,
  quietHoursEnd: 8,
  escalationDays: 40,
};

export const getPolicySettings = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  try {
    const result = await pool.query<{ details: Record<string, unknown> }>(
      `SELECT details
       FROM audit_logs
       WHERE company_id = $1
         AND action = 'UPDATE'
         AND resource_type = 'agent_policy'
       ORDER BY created_at DESC
       LIMIT 1`,
      [companyId]
    );
    const fromAudit = result.rows[0]?.details?.policy as PolicySettings | undefined;
    res.status(200).json({ data: fromAudit || DEFAULT_POLICY });
  } catch (error) {
    logError(LOG_MODULE, 'getPolicySettings', 'Failed to load policy settings', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const updatePolicySettings = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const userId = (req as any).userId as string;
  const payload = req.body as Partial<PolicySettings>;

  const nextPolicy: PolicySettings = {
    autonomyLevel: payload.autonomyLevel || DEFAULT_POLICY.autonomyLevel,
    maxEmailsPerWeek: Math.max(1, Math.min(14, Number(payload.maxEmailsPerWeek ?? DEFAULT_POLICY.maxEmailsPerWeek))),
    requireApprovalForHighRisk: Boolean(payload.requireApprovalForHighRisk ?? DEFAULT_POLICY.requireApprovalForHighRisk),
    quietHoursStart: Math.max(0, Math.min(23, Number(payload.quietHoursStart ?? DEFAULT_POLICY.quietHoursStart))),
    quietHoursEnd: Math.max(0, Math.min(23, Number(payload.quietHoursEnd ?? DEFAULT_POLICY.quietHoursEnd))),
    escalationDays: Math.max(7, Math.min(120, Number(payload.escalationDays ?? DEFAULT_POLICY.escalationDays))),
  };

  try {
    await AuditDB.createAuditLog({
      companyId,
      userId,
      action: 'UPDATE',
      resourceType: 'agent_policy',
      details: { policy: nextPolicy },
    });
    res.status(200).json({ data: nextPolicy });
  } catch (error) {
    logError(LOG_MODULE, 'updatePolicySettings', 'Failed to update policy settings', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const simulatePolicyDecision = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const userId = (req as any).userId as string;
  const {
    riskScore = 50,
    daysOverdue = 15,
    emailsSentThisWeek = 0,
    autonomyLevel = DEFAULT_POLICY.autonomyLevel,
    requireApprovalForHighRisk = DEFAULT_POLICY.requireApprovalForHighRisk,
    maxEmailsPerWeek = DEFAULT_POLICY.maxEmailsPerWeek,
  } = req.body as Partial<PolicySettings> & { riskScore?: number; daysOverdue?: number; emailsSentThisWeek?: number };

  const canSendByQuota = emailsSentThisWeek < maxEmailsPerWeek;
  const highRisk = riskScore >= 80 || daysOverdue >= 60;
  const requireApproval = autonomyLevel !== 'autonomous' || (requireApprovalForHighRisk && highRisk);
  const action = canSendByQuota ? (requireApproval ? 'queue_for_approval' : 'send_email') : 'skip_quota_reached';
  let approvalId: string | undefined;

  if (action === 'queue_for_approval') {
    try {
      const created = await PolicyApprovalsDB.createPolicyApproval({
        companyId,
        invoiceId: (req.body as any).invoiceId,
        requestedByUserId: userId,
        riskScore: Math.max(0, Math.min(100, Number(riskScore))),
        daysOverdue: Math.max(0, Number(daysOverdue)),
        reason: 'Simulation indicates human approval is required.',
      });
      approvalId = created.id;
    } catch (error) {
      logError(LOG_MODULE, 'simulatePolicyDecision', 'Failed to enqueue policy approval (non-blocking)', error, { companyId });
    }
  }

  try {
    await AuditDB.createAuditLog({
      companyId,
      userId,
      action: 'CREATE',
      resourceType: 'policy_simulation',
      details: {
        input: { riskScore, daysOverdue, emailsSentThisWeek, autonomyLevel, requireApprovalForHighRisk, maxEmailsPerWeek },
        output: { action, highRisk, canSendByQuota, requireApproval, approvalId },
      },
    });
  } catch (error) {
    logError(LOG_MODULE, 'simulatePolicyDecision', 'Failed to persist simulation audit (non-blocking)', error, { companyId });
  }

  res.status(200).json({
    data: {
      action,
      highRisk,
      canSendByQuota,
      requireApproval,
      approvalId,
      rationale: requireApproval
        ? 'Policy requires human review for this scenario.'
        : 'Policy permits autonomous action.',
    },
  });
};

export const listApprovalQueue = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const status = req.query.status as 'pending' | 'approved' | 'rejected' | undefined;
  try {
    const data = await PolicyApprovalsDB.listPolicyApprovals(companyId, status);
    res.status(200).json({ data });
  } catch (error) {
    logError(LOG_MODULE, 'listApprovalQueue', 'Failed to list approval queue', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const decideApprovalQueueItem = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const userId = (req as any).userId as string;
  const { approvalId } = req.params as { approvalId: string };
  const { decision, note } = req.body as { decision?: 'approved' | 'rejected'; note?: string };
  if (!decision || !['approved', 'rejected'].includes(decision)) {
    sendErrorResponse(res, 400, 'decision must be approved or rejected');
    return;
  }
  try {
    const ok = await PolicyApprovalsDB.decidePolicyApproval({
      id: approvalId,
      companyId,
      approvedByUserId: userId,
      status: decision,
      decisionNote: note,
    });
    if (!ok) {
      sendErrorResponse(res, 404, 'Approval item not found or already decided');
      return;
    }
    await AuditDB.createAuditLog({
      companyId,
      userId,
      action: 'UPDATE',
      resourceType: 'policy_approval',
      resourceId: approvalId,
      details: { decision, note: note || null },
    });
    res.status(200).json({ message: 'Approval decision saved' });
  } catch (error) {
    logError(LOG_MODULE, 'decideApprovalQueueItem', 'Failed to decide approval item', error, { companyId, approvalId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};



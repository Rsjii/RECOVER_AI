"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.decideApprovalQueueItem = exports.listApprovalQueue = exports.simulatePolicyDecision = exports.updatePolicySettings = exports.getPolicySettings = void 0;
const database_1 = require("../config/database");
const AuditDB = __importStar(require("../db/auditLogs"));
const PolicyApprovalsDB = __importStar(require("../db/policyApprovals"));
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
const LOG_MODULE = 'policyController';
const DEFAULT_POLICY = {
    autonomyLevel: 'autonomous',
    maxEmailsPerWeek: 5,
    requireApprovalForHighRisk: true,
    quietHoursStart: 20,
    quietHoursEnd: 8,
    escalationDays: 40,
};
const getPolicySettings = async (req, res) => {
    const companyId = req.companyId;
    try {
        const result = await database_1.pool.query(`SELECT details
       FROM audit_logs
       WHERE company_id = $1
         AND action = 'UPDATE'
         AND resource_type = 'agent_policy'
       ORDER BY created_at DESC
       LIMIT 1`, [companyId]);
        const fromAudit = result.rows[0]?.details?.policy;
        res.status(200).json({ data: fromAudit || DEFAULT_POLICY });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'getPolicySettings', 'Failed to load policy settings', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getPolicySettings = getPolicySettings;
const updatePolicySettings = async (req, res) => {
    const companyId = req.companyId;
    const userId = req.userId;
    const payload = req.body;
    const nextPolicy = {
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
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'updatePolicySettings', 'Failed to update policy settings', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.updatePolicySettings = updatePolicySettings;
const simulatePolicyDecision = async (req, res) => {
    const companyId = req.companyId;
    const userId = req.userId;
    const { riskScore = 50, daysOverdue = 15, emailsSentThisWeek = 0, autonomyLevel = DEFAULT_POLICY.autonomyLevel, requireApprovalForHighRisk = DEFAULT_POLICY.requireApprovalForHighRisk, maxEmailsPerWeek = DEFAULT_POLICY.maxEmailsPerWeek, } = req.body;
    const canSendByQuota = emailsSentThisWeek < maxEmailsPerWeek;
    const highRisk = riskScore >= 80 || daysOverdue >= 60;
    const requireApproval = autonomyLevel !== 'autonomous' || (requireApprovalForHighRisk && highRisk);
    const action = canSendByQuota ? (requireApproval ? 'queue_for_approval' : 'send_email') : 'skip_quota_reached';
    let approvalId;
    if (action === 'queue_for_approval') {
        try {
            const created = await PolicyApprovalsDB.createPolicyApproval({
                companyId,
                invoiceId: req.body.invoiceId,
                requestedByUserId: userId,
                riskScore: Math.max(0, Math.min(100, Number(riskScore))),
                daysOverdue: Math.max(0, Number(daysOverdue)),
                reason: 'Simulation indicates human approval is required.',
            });
            approvalId = created.id;
        }
        catch (error) {
            (0, logger_1.logError)(LOG_MODULE, 'simulatePolicyDecision', 'Failed to enqueue policy approval (non-blocking)', error, { companyId });
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
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'simulatePolicyDecision', 'Failed to persist simulation audit (non-blocking)', error, { companyId });
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
exports.simulatePolicyDecision = simulatePolicyDecision;
const listApprovalQueue = async (req, res) => {
    const companyId = req.companyId;
    const status = req.query.status;
    try {
        const data = await PolicyApprovalsDB.listPolicyApprovals(companyId, status);
        res.status(200).json({ data });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'listApprovalQueue', 'Failed to list approval queue', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.listApprovalQueue = listApprovalQueue;
const decideApprovalQueueItem = async (req, res) => {
    const companyId = req.companyId;
    const userId = req.userId;
    const { approvalId } = req.params;
    const { decision, note } = req.body;
    if (!decision || !['approved', 'rejected'].includes(decision)) {
        (0, errorHandler_1.sendErrorResponse)(res, 400, 'decision must be approved or rejected');
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
            (0, errorHandler_1.sendErrorResponse)(res, 404, 'Approval item not found or already decided');
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
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'decideApprovalQueueItem', 'Failed to decide approval item', error, { companyId, approvalId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.decideApprovalQueueItem = decideApprovalQueueItem;

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
exports.acceptInvitation = exports.validateInvitation = exports.revokeMember = exports.updateMemberRole = exports.inviteMember = exports.listTeamMembers = void 0;
const TeamDB = __importStar(require("../db/team"));
const AuditDB = __importStar(require("../db/auditLogs"));
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
const LOG_MODULE = 'teamController';
const VALID_ROLES = ['owner', 'admin', 'member', 'viewer'];
const listTeamMembers = async (req, res) => {
    const companyId = req.companyId;
    try {
        const [members, invitations] = await Promise.all([
            TeamDB.listMembers(companyId),
            TeamDB.listInvitations(companyId),
        ]);
        res.status(200).json({ data: { members, invitations } });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'listTeamMembers', 'Failed to fetch team', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.listTeamMembers = listTeamMembers;
const inviteMember = async (req, res) => {
    const companyId = req.companyId;
    const userId = req.userId;
    const { email, role } = req.body;
    if (!email || !role || !VALID_ROLES.includes(role)) {
        (0, errorHandler_1.sendErrorResponse)(res, 400, 'email and valid role are required');
        return;
    }
    try {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const invitation = await TeamDB.createInvitation({
            companyId,
            email,
            role,
            invitedByUserId: userId,
            expiresAt,
        });
        await AuditDB.createAuditLog({
            companyId,
            userId,
            action: 'CREATE',
            resourceType: 'team_invitation',
            details: { email, role },
        });
        res.status(201).json({
            message: 'Invitation created',
            data: {
                token: invitation.token,
                expiresAt: expiresAt.toISOString(),
            },
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'inviteMember', 'Failed to create invitation', error, { companyId, email });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.inviteMember = inviteMember;
const updateMemberRole = async (req, res) => {
    const companyId = req.companyId;
    const actorUserId = req.userId;
    const { userId } = req.params;
    const { role } = req.body;
    if (!role || !VALID_ROLES.includes(role)) {
        (0, errorHandler_1.sendErrorResponse)(res, 400, 'Valid role is required');
        return;
    }
    try {
        await TeamDB.updateMemberRole(companyId, userId, role);
        await AuditDB.createAuditLog({
            companyId,
            userId: actorUserId,
            action: 'UPDATE',
            resourceType: 'team_member',
            resourceId: userId,
            details: { role },
        });
        res.status(200).json({ message: 'Member role updated' });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'updateMemberRole', 'Failed to update member role', error, { companyId, userId, role });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.updateMemberRole = updateMemberRole;
const revokeMember = async (req, res) => {
    const companyId = req.companyId;
    const actorUserId = req.userId;
    const { userId } = req.params;
    try {
        await TeamDB.revokeMember(companyId, userId);
        await AuditDB.createAuditLog({
            companyId,
            userId: actorUserId,
            action: 'DELETE',
            resourceType: 'team_member',
            resourceId: userId,
        });
        res.status(200).json({ message: 'Member revoked' });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'revokeMember', 'Failed to revoke member', error, { companyId, userId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.revokeMember = revokeMember;
const validateInvitation = async (req, res) => {
    const token = req.query.token;
    if (!token) {
        (0, errorHandler_1.sendErrorResponse)(res, 400, 'token is required');
        return;
    }
    try {
        const result = await (0, database_1.query)(`SELECT id, email, role, expires_at, accepted_at
       FROM invitations
       WHERE token = $1`, [token]);
        const invitation = result.rows[0];
        if (!invitation) {
            (0, errorHandler_1.sendErrorResponse)(res, 404, 'Invitation not found');
            return;
        }
        if (invitation.accepted_at) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Invitation already accepted');
            return;
        }
        if (new Date(invitation.expires_at).getTime() < Date.now()) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Invitation expired');
            return;
        }
        res.status(200).json({ data: invitation });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'validateInvitation', 'Failed to validate invitation', error);
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.validateInvitation = validateInvitation;
const acceptInvitation = async (req, res) => {
    const token = req.body?.token;
    const userId = req.userId;
    if (!token) {
        (0, errorHandler_1.sendErrorResponse)(res, 400, 'token is required');
        return;
    }
    try {
        const invitationResult = await (0, database_1.query)(`SELECT id, company_id, role, expires_at, accepted_at
       FROM invitations
       WHERE token = $1`, [token]);
        const invitation = invitationResult.rows[0];
        if (!invitation) {
            (0, errorHandler_1.sendErrorResponse)(res, 404, 'Invitation not found');
            return;
        }
        if (invitation.accepted_at) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Invitation already accepted');
            return;
        }
        if (new Date(invitation.expires_at).getTime() < Date.now()) {
            (0, errorHandler_1.sendErrorResponse)(res, 400, 'Invitation expired');
            return;
        }
        await (0, database_1.transaction)(async (client) => {
            await client.query(`UPDATE users SET company_id = $1, role = $2, updated_at = NOW() WHERE id = $3`, [invitation.company_id, invitation.role, userId]);
            await client.query(`INSERT INTO organization_members (company_id, user_id, role)
         VALUES ($1,$2,$3)
         ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`, [invitation.company_id, userId, invitation.role]);
            await client.query(`UPDATE invitations SET accepted_at = NOW() WHERE id = $1`, [invitation.id]);
        });
        (0, logger_1.logInfo)(LOG_MODULE, 'acceptInvitation', 'Invitation accepted', { invitationId: invitation.id, userId });
        res.status(200).json({ message: 'Invitation accepted' });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'acceptInvitation', 'Failed to accept invitation', error, { userId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.acceptInvitation = acceptInvitation;

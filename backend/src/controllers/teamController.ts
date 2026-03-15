import { Request, Response } from 'express';
import * as TeamDB from '../db/team';
import * as AuditDB from '../db/auditLogs';
import { query, transaction } from '../config/database';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'teamController';
const VALID_ROLES: TeamDB.TeamRole[] = ['owner', 'admin', 'member', 'viewer'];

export const listTeamMembers = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  try {
    const [members, invitations] = await Promise.all([
      TeamDB.listMembers(companyId),
      TeamDB.listInvitations(companyId),
    ]);
    res.status(200).json({ data: { members, invitations } });
  } catch (error) {
    logError(LOG_MODULE, 'listTeamMembers', 'Failed to fetch team', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const inviteMember = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const userId = (req as any).userId as string;
  const { email, role } = req.body as { email?: string; role?: TeamDB.TeamRole };

  if (!email || !role || !VALID_ROLES.includes(role)) {
    sendErrorResponse(res, 400, 'email and valid role are required');
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
  } catch (error) {
    logError(LOG_MODULE, 'inviteMember', 'Failed to create invitation', error, { companyId, email });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const actorUserId = (req as any).userId as string;
  const { userId } = req.params as { userId: string };
  const { role } = req.body as { role?: TeamDB.TeamRole };

  if (!role || !VALID_ROLES.includes(role)) {
    sendErrorResponse(res, 400, 'Valid role is required');
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
  } catch (error) {
    logError(LOG_MODULE, 'updateMemberRole', 'Failed to update member role', error, { companyId, userId, role });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const revokeMember = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const actorUserId = (req as any).userId as string;
  const { userId } = req.params as { userId: string };
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
  } catch (error) {
    logError(LOG_MODULE, 'revokeMember', 'Failed to revoke member', error, { companyId, userId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const validateInvitation = async (req: Request, res: Response): Promise<void> => {
  const token = req.query.token as string;
  if (!token) {
    sendErrorResponse(res, 400, 'token is required');
    return;
  }

  try {
    const result = await query(
      `SELECT id, email, role, expires_at, accepted_at
       FROM invitations
       WHERE token = $1`,
      [token]
    );
    const invitation = result.rows[0];
    if (!invitation) {
      sendErrorResponse(res, 404, 'Invitation not found');
      return;
    }
    if (invitation.accepted_at) {
      sendErrorResponse(res, 400, 'Invitation already accepted');
      return;
    }
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      sendErrorResponse(res, 400, 'Invitation expired');
      return;
    }
    res.status(200).json({ data: invitation });
  } catch (error) {
    logError(LOG_MODULE, 'validateInvitation', 'Failed to validate invitation', error);
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const acceptInvitation = async (req: Request, res: Response): Promise<void> => {
  const token = req.body?.token as string;
  const userId = (req as any).userId as string;

  if (!token) {
    sendErrorResponse(res, 400, 'token is required');
    return;
  }

  try {
    const invitationResult = await query(
      `SELECT id, company_id, role, expires_at, accepted_at
       FROM invitations
       WHERE token = $1`,
      [token]
    );
    const invitation = invitationResult.rows[0];
    if (!invitation) {
      sendErrorResponse(res, 404, 'Invitation not found');
      return;
    }
    if (invitation.accepted_at) {
      sendErrorResponse(res, 400, 'Invitation already accepted');
      return;
    }
    if (new Date(invitation.expires_at).getTime() < Date.now()) {
      sendErrorResponse(res, 400, 'Invitation expired');
      return;
    }

    await transaction(async (client) => {
      await client.query(
        `UPDATE users SET company_id = $1, role = $2, updated_at = NOW() WHERE id = $3`,
        [invitation.company_id, invitation.role, userId]
      );
      await client.query(
        `INSERT INTO organization_members (company_id, user_id, role)
         VALUES ($1,$2,$3)
         ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = NOW()`,
        [invitation.company_id, userId, invitation.role]
      );
      await client.query(`UPDATE invitations SET accepted_at = NOW() WHERE id = $1`, [invitation.id]);
    });

    logInfo(LOG_MODULE, 'acceptInvitation', 'Invitation accepted', { invitationId: invitation.id, userId });
    res.status(200).json({ message: 'Invitation accepted' });
  } catch (error) {
    logError(LOG_MODULE, 'acceptInvitation', 'Failed to accept invitation', error, { userId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};



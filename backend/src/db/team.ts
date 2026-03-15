import crypto from 'crypto';
import { pool } from '../config/database';

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export async function ensureOwnerMembership(companyId: string, userId: string): Promise<void> {
  await pool.query(
    `INSERT INTO organization_members (company_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT (company_id, user_id)
     DO UPDATE SET role = 'owner', updated_at = NOW()`,
    [companyId, userId]
  );
}

export async function listMembers(companyId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT om.id, om.role, om.created_at,
            u.id AS user_id, u.email, u.first_name, u.last_name, u.is_active
     FROM organization_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.company_id = $1
     ORDER BY CASE om.role
       WHEN 'owner' THEN 1
       WHEN 'admin' THEN 2
       WHEN 'member' THEN 3
       ELSE 4 END, u.created_at ASC`,
    [companyId]
  );
  return result.rows;
}

export async function updateMemberRole(companyId: string, userId: string, role: TeamRole): Promise<void> {
  await pool.query(
    `UPDATE organization_members
     SET role = $3, updated_at = NOW()
     WHERE company_id = $1 AND user_id = $2`,
    [companyId, userId, role]
  );
}

export async function revokeMember(companyId: string, userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM organization_members
     WHERE company_id = $1 AND user_id = $2`,
    [companyId, userId]
  );
}

export async function createInvitation(input: {
  companyId: string;
  email: string;
  role: TeamRole;
  invitedByUserId: string;
  expiresAt: Date;
}): Promise<{ token: string }> {
  const token = crypto.randomBytes(24).toString('hex');
  await pool.query(
    `INSERT INTO invitations (company_id, email, role, invited_by_user_id, token, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (company_id, email)
     DO UPDATE SET
       role = EXCLUDED.role,
       invited_by_user_id = EXCLUDED.invited_by_user_id,
       token = EXCLUDED.token,
       expires_at = EXCLUDED.expires_at,
       accepted_at = NULL,
       created_at = NOW()`,
    [input.companyId, input.email.toLowerCase(), input.role, input.invitedByUserId, token, input.expiresAt]
  );
  return { token };
}

export async function listInvitations(companyId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT id, email, role, token, expires_at, accepted_at, created_at
     FROM invitations
     WHERE company_id = $1
     ORDER BY created_at DESC`,
    [companyId]
  );
  return result.rows;
}



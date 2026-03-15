import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../config/db';
import { emailService } from '../../services/emailService';
import { AuthRequest } from '../../types';
import { config } from '../../config/env';
import { logger } from '../../config/logger';

export const getTeam = async (req: AuthRequest, res: Response) => {
  if (!req.orgId) return res.json({ org: null, members: [] });

  const orgRes = await db.query(`SELECT * FROM organizations WHERE id = $1`, [req.orgId]);
  const membersRes = await db.query(
    `SELECT tm.*, u.github_username, u.email, u.avatar_url
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.org_id = $1 ORDER BY tm.joined_at ASC`,
    [req.orgId]
  );
  const invitesRes = await db.query(
    `SELECT * FROM invites WHERE org_id = $1 AND accepted_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [req.orgId]
  );

  res.json({ org: orgRes.rows[0], members: membersRes.rows, pending_invites: invitesRes.rows });
};

export const setupOrg = async (req: AuthRequest, res: Response) => {
  const { github_org_name, github_org_id } = req.body;
  if (!github_org_name) return res.status(400).json({ error: 'org_name required' });

  const orgRes = await db.query(
    `INSERT INTO organizations (github_org_id, github_org_name, created_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [github_org_id || null, github_org_name, req.userId]
  );
  const org = orgRes.rows[0];

  await db.query(`UPDATE users SET org_id = $1 WHERE id = $2`, [org.id, req.userId]);
  await db.query(
    `INSERT INTO team_members (user_id, org_id, role) VALUES ($1, $2, 'admin')
     ON CONFLICT (user_id, org_id) DO UPDATE SET role = 'admin'`,
    [req.userId, org.id]
  );
  await db.query(
    `INSERT INTO subscriptions (org_id, tier, status) VALUES ($1, 'free', 'active')
     ON CONFLICT (org_id) DO NOTHING`,
    [org.id]
  );

  res.status(201).json({ org });
};

export const sendInvite = async (req: AuthRequest, res: Response) => {
  const { email, role } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'email required' });

  const existing = await db.query(
    `SELECT id FROM invites WHERE org_id = $1 AND email = $2 AND accepted_at IS NULL AND expires_at > NOW()`,
    [req.orgId, email.trim()]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An active invite already exists for this email. Revoke it first to resend.' });
  }

  const token = uuidv4();
  await db.query(
    `INSERT INTO invites (org_id, email, token, role, invited_by) VALUES ($1, $2, $3, $4, $5)`,
    [req.orgId, email.trim(), token, role || 'developer', req.userId]
  );

  const orgRes = await db.query(`SELECT github_org_name FROM organizations WHERE id = $1`, [req.orgId]);
  await emailService.sendInvite(email.trim(), token, orgRes.rows[0]?.github_org_name || 'your team');
  res.json({ success: true });
};

export const resendInvite = async (req: AuthRequest, res: Response) => {
  const invite = await db.query(
    `SELECT i.*, o.github_org_name FROM invites i
     JOIN organizations o ON o.id = i.org_id
     WHERE i.id = $1 AND i.org_id = $2 AND i.accepted_at IS NULL`,
    [req.params.inviteId, req.orgId]
  );
  if (!invite.rows[0]) return res.status(404).json({ error: 'Invite not found' });

  await db.query(
    `UPDATE invites SET expires_at = NOW() + INTERVAL '7 days' WHERE id = $1`,
    [req.params.inviteId]
  );

  await emailService.sendInvite(
    invite.rows[0].email,
    invite.rows[0].token,
    invite.rows[0].github_org_name
  );
  res.json({ success: true });
};

export const revokeInvite = async (req: AuthRequest, res: Response) => {
  const r = await db.query(
    `DELETE FROM invites WHERE id = $1 AND org_id = $2 RETURNING id`,
    [req.params.inviteId, req.orgId]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Invite not found' });
  res.json({ success: true });
};

export const validateInvite = async (req: Request, res: Response) => {
  const { token } = req.params;
  const r = await db.query(
    `SELECT i.*, o.github_org_name FROM invites i
     JOIN organizations o ON o.id = i.org_id
     WHERE i.token = $1 AND i.accepted_at IS NULL AND i.expires_at > NOW()`,
    [token]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Invalid or expired invite' });
  res.json({ invite: r.rows[0] });
};

export const acceptInvite = async (req: AuthRequest, res: Response) => {
  const inviteRes = await db.query(
    `SELECT * FROM invites WHERE token = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
    [req.params.token]
  );
  if (!inviteRes.rows[0]) return res.status(404).json({ error: 'Invalid or expired invite' });
  const invite = inviteRes.rows[0];

  const isMember = await db.query(
    `SELECT 1 FROM team_members WHERE user_id = $1 AND org_id = $2`,
    [req.userId, invite.org_id]
  );
  if (isMember.rows[0]) {
    await db.query(`UPDATE invites SET accepted_at = NOW() WHERE id = $1`, [invite.id]);
    return res.json({ success: true, org_id: invite.org_id, already_member: true });
  }

  const userRes = await db.query(`SELECT org_id FROM users WHERE id = $1`, [req.userId]);
  const currentOrgId = userRes.rows[0]?.org_id;
  if (currentOrgId && currentOrgId !== invite.org_id) {
    const currentOrg = await db.query(`SELECT github_org_name FROM organizations WHERE id = $1`, [currentOrgId]);
    const currentOrgName = currentOrg.rows[0]?.github_org_name || 'another workspace';
    return res.status(409).json({
      error: `You are already a member of "${currentOrgName}". You can only belong to one workspace. Ask your current admin to remove you first.`,
    });
  }

  await db.query(`UPDATE users SET org_id = $1 WHERE id = $2`, [invite.org_id, req.userId]);
  await db.query(
    `INSERT INTO team_members (user_id, org_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, org_id) DO UPDATE SET role = $3`,
    [req.userId, invite.org_id, invite.role]
  );
  await db.query(`UPDATE invites SET accepted_at = NOW() WHERE id = $1`, [invite.id]);

  res.json({ success: true, org_id: invite.org_id });
};

export const leaveTeam = async (req: AuthRequest, res: Response) => {
  if (!req.orgId) return res.status(400).json({ error: 'Not in any team' });

  if (req.user?.role === 'admin') {
    const adminCount = await db.query(
      `SELECT COUNT(*) FROM team_members WHERE org_id = $1 AND role = 'admin'`,
      [req.orgId]
    );
    if (Number(adminCount.rows[0].count) <= 1) {
      return res.status(400).json({
        error: 'You are the only admin. Promote another member to admin before leaving.',
      });
    }
  }

  await db.query(`DELETE FROM team_members WHERE user_id = $1 AND org_id = $2`, [req.userId, req.orgId]);
  await db.query(`UPDATE users SET org_id = NULL WHERE id = $1`, [req.userId]);
  res.json({ success: true });
};

export const updateMemberRole = async (req: AuthRequest, res: Response) => {
  const { role } = req.body;
  if (!['admin', 'reviewer', 'developer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  await db.query(
    `UPDATE team_members SET role = $1 WHERE user_id = $2 AND org_id = $3`,
    [role, req.params.userId, req.orgId]
  );
  res.json({ success: true });
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  if (req.params.userId === req.userId) {
    return res.status(400).json({ error: 'Use "Leave team" to remove yourself' });
  }
  await db.query(`DELETE FROM team_members WHERE user_id = $1 AND org_id = $2`, [req.params.userId, req.orgId]);
  await db.query(`UPDATE users SET org_id = NULL WHERE id = $1 AND org_id = $2`, [req.params.userId, req.orgId]);
  res.json({ success: true });
};

// ─────────────────────────────────────────────────────────────────────────────
// Join Links (shareable link — anyone can use to join as developer)
// ─────────────────────────────────────────────────────────────────────────────

export const createJoinLink = async (req: AuthRequest, res: Response) => {
  const { role = 'developer', expires_in_days = 30 } = req.body;
  if (!['developer', 'reviewer', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const days = Math.min(Math.max(Number(expires_in_days) || 30, 1), 90);

  const token = uuidv4();
  const r = await db.query(
    `INSERT INTO join_links (org_id, token, role, created_by, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::INTERVAL)
     RETURNING *`,
    [req.orgId, token, role, req.userId, days]
  );

  res.status(201).json({ join_link: r.rows[0] });
};

export const listJoinLinks = async (req: AuthRequest, res: Response) => {
  const r = await db.query(
    `SELECT jl.*, u.github_username as created_by_username
     FROM join_links jl
     LEFT JOIN users u ON u.id = jl.created_by
     WHERE jl.org_id = $1 AND jl.is_active = true AND jl.expires_at > NOW()
     ORDER BY jl.created_at DESC`,
    [req.orgId]
  );
  res.json({ join_links: r.rows });
};

export const revokeJoinLink = async (req: AuthRequest, res: Response) => {
  const r = await db.query(
    `UPDATE join_links SET is_active = false
     WHERE id = $1 AND org_id = $2 RETURNING id`,
    [req.params.linkId, req.orgId]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Join link not found' });
  res.json({ success: true });
};

export const validateJoinLink = async (req: Request, res: Response) => {
  const r = await db.query(
    `SELECT jl.*, o.github_org_name
     FROM join_links jl
     JOIN organizations o ON o.id = jl.org_id
     WHERE jl.token = $1 AND jl.is_active = true AND jl.expires_at > NOW()`,
    [req.params.token]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Invalid or expired join link' });
  res.json({ join_link: r.rows[0] });
};

export const acceptJoinLink = async (req: AuthRequest, res: Response) => {
  const r = await db.query(
    `SELECT * FROM join_links WHERE token = $1 AND is_active = true AND expires_at > NOW()`,
    [req.params.token]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Invalid or expired join link' });
  const link = r.rows[0];

  // Already a member of this org
  const isMember = await db.query(
    `SELECT 1 FROM team_members WHERE user_id = $1 AND org_id = $2`,
    [req.userId, link.org_id]
  );
  if (isMember.rows[0]) {
    return res.json({ success: true, org_id: link.org_id, already_member: true });
  }

  // Already in a DIFFERENT org
  const userRes = await db.query(`SELECT org_id FROM users WHERE id = $1`, [req.userId]);
  const currentOrgId = userRes.rows[0]?.org_id;
  if (currentOrgId && currentOrgId !== link.org_id) {
    const currentOrg = await db.query(`SELECT github_org_name FROM organizations WHERE id = $1`, [currentOrgId]);
    const currentOrgName = currentOrg.rows[0]?.github_org_name || 'another workspace';
    return res.status(409).json({
      error: `You are already a member of "${currentOrgName}". You can only belong to one workspace.`,
    });
  }

  // Join the org
  await db.query(`UPDATE users SET org_id = $1 WHERE id = $2`, [link.org_id, req.userId]);
  await db.query(
    `INSERT INTO team_members (user_id, org_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, org_id) DO UPDATE SET role = $3`,
    [req.userId, link.org_id, link.role]
  );
  await db.query(
    `UPDATE join_links SET uses_count = uses_count + 1 WHERE id = $1`,
    [link.id]
  );

  res.json({ success: true, org_id: link.org_id });
};

import { Request, Response } from 'express';
import { AuthRequest } from '../../types';
import { db } from '../../config/db';
import { logActivity } from '../../lib/activity';
import crypto from 'crypto';

// ── List active join links ─────────────────────────────────────────────────
export const listJoinLinks = async (req: AuthRequest, res: Response) => {
  const rows = await db.query(
    `SELECT jl.id, jl.token, jl.role, jl.is_active, jl.expires_at,
            jl.uses_count, jl.created_at, u.github_username as created_by_username
     FROM join_links jl
     LEFT JOIN users u ON u.id = jl.created_by
     WHERE jl.org_id = $1
     ORDER BY jl.created_at DESC`,
    [req.orgId]
  );
  res.json({ join_links: rows.rows });
};

// ── Generate a new join link ───────────────────────────────────────────────
export const createJoinLink = async (req: AuthRequest, res: Response) => {
  const { role = 'developer' } = req.body;
  const validRoles = ['admin', 'reviewer', 'developer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin, reviewer, or developer.' });
  }

  const token = crypto.randomBytes(24).toString('hex');

  const r = await db.query(
    `INSERT INTO join_links (org_id, token, role, created_by, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')
     RETURNING *`,
    [req.orgId, token, role, req.userId]
  );

  await logActivity(req.orgId!, req.userId!, 'join_link_created', `Join link created for role: ${role}`);

  const org = await db.query(`SELECT github_org_name FROM organizations WHERE id = $1`, [req.orgId]);
  const orgName = org.rows[0]?.github_org_name || 'your org';

  res.json({
    join_link: r.rows[0],
    url: `${process.env.FRONTEND_URL || ''}/join/${token}`,
    message: `Share this link to invite people to ${orgName} as ${role}`,
  });
};

// ── Deactivate a join link ─────────────────────────────────────────────────
export const deactivateJoinLink = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const r = await db.query(
    `UPDATE join_links SET is_active = false
     WHERE id = $1 AND org_id = $2
     RETURNING id`,
    [id, req.orgId]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Join link not found' });

  await logActivity(req.orgId!, req.userId!, 'join_link_revoked', `Join link revoked`);
  res.json({ success: true });
};

// ── Accept a join link (any authenticated user) ────────────────────────────
export const acceptJoinLink = async (req: AuthRequest, res: Response) => {
  const { token } = req.params;

  // Fetch link
  const linkRes = await db.query(
    `SELECT * FROM join_links
     WHERE token = $1 AND is_active = true AND expires_at > NOW()`,
    [token]
  );
  if (linkRes.rows.length === 0) {
    return res.status(400).json({ error: 'Join link is invalid, expired, or already used.' });
  }
  const link = linkRes.rows[0];

  // Check if user already in THIS org
  const existingMember = await db.query(
    `SELECT id FROM team_members WHERE user_id = $1 AND org_id = $2`,
    [req.userId, link.org_id]
  );
  if (existingMember.rows.length > 0) {
    return res.status(400).json({ error: 'You are already a member of this organization.' });
  }

  // Check if user is in a DIFFERENT org
  const userRes = await db.query(`SELECT org_id FROM users WHERE id = $1`, [req.userId]);
  if (userRes.rows[0]?.org_id && userRes.rows[0].org_id !== link.org_id) {
    return res.status(400).json({
      error: 'You are already in another organization. Log out and use a different GitHub account to join this org.',
    });
  }

  // Add to org
  await db.query(`UPDATE users SET org_id = $1 WHERE id = $2`, [link.org_id, req.userId]);
  await db.query(
    `INSERT INTO team_members (user_id, org_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, org_id) DO NOTHING`,
    [req.userId, link.org_id, link.role]
  );
  await db.query(
    `UPDATE join_links SET uses_count = uses_count + 1 WHERE id = $1`,
    [link.id]
  );

  const orgRes = await db.query(
    `SELECT github_org_name FROM organizations WHERE id = $1`,
    [link.org_id]
  );

  res.json({
    success: true,
    org_name: orgRes.rows[0]?.github_org_name,
    role: link.role,
  });
};

// ── Get join link info (public — no auth, just token) ─────────────────────
export const getJoinLinkInfo = async (req: Request, res: Response) => {
  const { token } = req.params;
  const r = await db.query(
    `SELECT jl.role, jl.expires_at, jl.is_active, o.github_org_name
     FROM join_links jl
     JOIN organizations o ON o.id = jl.org_id
     WHERE jl.token = $1`,
    [token]
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Link not found' });

  const link = r.rows[0];
  if (!link.is_active || new Date(link.expires_at) < new Date()) {
    return res.status(400).json({ error: 'This link has expired or been revoked.' });
  }

  res.json({
    org_name: link.github_org_name,
    role: link.role,
    expires_at: link.expires_at,
  });
};

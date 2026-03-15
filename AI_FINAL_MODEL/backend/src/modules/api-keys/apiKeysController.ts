import { Response } from 'express';
import crypto from 'crypto';
import { db } from '../../config/db';
import { AuthRequest } from '../../types';
import { logActivity } from '../../lib/activity';

function makeKey() {
  const raw = crypto.randomBytes(32).toString('hex');
  return {
    full: `cm_live_${raw}`,
    prefix: raw.slice(0, 8),
    hashed: crypto.createHash('sha256').update(`cm_live_${raw}`).digest('hex'),
  };
}

export const listApiKeys = async (req: AuthRequest, res: Response) => {
  const r = await db.query(
    `SELECT id, name, key_prefix, created_at, last_used
     FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC`,
    [req.orgId]
  );
  res.json({ keys: r.rows });
};

export const createApiKey = async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const { full, prefix, hashed } = makeKey();
  const r = await db.query(
    `INSERT INTO api_keys (org_id, name, key_prefix, hashed_key)
     VALUES ($1, $2, $3, $4) RETURNING id, name, key_prefix, created_at`,
    [req.orgId, name.trim(), prefix, hashed]
  );
  await logActivity(req.orgId!, req.userId!, 'api_key_created', `API key "${name.trim()}" created`);
  res.status(201).json({ key: { ...r.rows[0], full_key: full } });
};

export const revokeApiKey = async (req: AuthRequest, res: Response) => {
  const r = await db.query(
    `DELETE FROM api_keys WHERE id = $1 AND org_id = $2 RETURNING name`,
    [req.params.keyId, req.orgId]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Key not found' });
  await logActivity(req.orgId!, req.userId!, 'api_key_revoked', `API key "${r.rows[0].name}" revoked`);
  res.json({ success: true });
};

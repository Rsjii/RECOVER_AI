import { Response } from 'express';
import { AuthRequest } from '../../types';
import * as prDao from './prDao';
import { db } from '../../config/db';

export const listPRs = async (req: AuthRequest, res: Response) => {
  const { repo_id, risk_level, days, page, limit } = req.query;
  const result = await prDao.listPRs(req.orgId!, {
    repoId: repo_id as string,
    riskLevel: risk_level as string,
    days: days ? Number(days) : 30,
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
  });
  res.json(result);
};

export const getPR = async (req: AuthRequest, res: Response) => {
  const pr = await prDao.getPRById(req.params.prId, req.orgId!);
  if (!pr) return res.status(404).json({ error: 'Not found' });
  res.json({ pr });
};

export const getNotes = async (req: AuthRequest, res: Response) => {
  const r = await db.query(
    `SELECT n.id, n.note, n.created_at, n.github_username, n.user_id
     FROM pr_notes n
     WHERE n.pr_id = $1 AND n.org_id = $2
     ORDER BY n.created_at ASC`,
    [req.params.prId, req.orgId]
  );
  res.json({ notes: r.rows });
};

export const addNote = async (req: AuthRequest, res: Response) => {
  const { note } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'note required' });
  if (req.user?.role === 'developer') return res.status(403).json({ error: 'Read-only access' });

  const r = await db.query(
    `INSERT INTO pr_notes (pr_id, org_id, user_id, github_username, note)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.params.prId, req.orgId, req.userId, req.user?.github_username ?? null, note.trim()]
  );
  res.status(201).json({ note: r.rows[0] });
};

export const deleteNote = async (req: AuthRequest, res: Response) => {
  const r = await db.query(
    `SELECT user_id FROM pr_notes WHERE id = $1 AND org_id = $2`,
    [req.params.noteId, req.orgId]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Note not found' });
  if (req.user?.role !== 'admin' && r.rows[0].user_id !== req.userId) {
    return res.status(403).json({ error: 'Not allowed' });
  }
  await db.query(`DELETE FROM pr_notes WHERE id = $1`, [req.params.noteId]);
  res.json({ success: true });
};

import { Response } from 'express';
import { AuthRequest } from '../../types';
import { claudeService } from '../../services/claudeService';
import { embeddingService } from '../../services/embeddingService';
import { db } from '../../config/db';

export const handleSearch = async (req: AuthRequest, res: Response) => {
  const { query } = req.body;
  if (!query?.trim()) return res.status(400).json({ error: 'query required' });

  const { embedding } = await embeddingService.generateEmbedding(query);
  const vecStr = `[${embedding.join(',')}]`;

  // Search code chunks + git stats in parallel
  const [chunksRes, prRes] = await Promise.all([
    db.query(
      `SELECT cc.file_path, cc.name, cc.chunk_type, cc.content, cc.start_line, cc.end_line,
              1 - (cc.embedding <=> $1::vector) AS similarity,
              fgs.bus_factor, fgs.primary_owner_name, fgs.incident_count,
              fgs.last_commit_date, fgs.churn_score
       FROM code_chunks cc
       LEFT JOIN repositories r ON r.id = cc.repo_id
       LEFT JOIN file_git_stats fgs ON fgs.repo_id = cc.repo_id AND fgs.file_path = cc.file_path
       WHERE cc.org_id = $2
       ORDER BY cc.embedding <=> $1::vector
       LIMIT 8`,
      [vecStr, req.orgId]
    ),
    // Also search historical PR titles/bodies for context
    db.query(
      `SELECT pr_number, title, pr_created_at, pr_state, author,
              1 - (embedding <=> $1::vector) AS similarity
       FROM pull_requests
       WHERE org_id = $2 AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT 3`,
      [vecStr, req.orgId]
    ),
  ]);

  // Build code context
  const codeContext = chunksRes.rows.map(c =>
    `File: ${c.file_path}:${c.start_line || 0}\n${c.content}`
  ).join('\n\n---\n\n');

  // Build git context for answer enrichment
  const gitLines: string[] = [];
  const seenFiles = new Set<string>();
  for (const c of chunksRes.rows) {
    if (seenFiles.has(c.file_path)) continue;
    seenFiles.add(c.file_path);
    if (c.bus_factor || c.primary_owner_name) {
      gitLines.push(
        `${c.file_path}: owner=${c.primary_owner_name || 'unknown'}, ` +
        `bus_factor=${c.bus_factor || '?'}, incidents=${c.incident_count || 0}, ` +
        `last_touched=${c.last_commit_date ? new Date(c.last_commit_date).toLocaleDateString() : 'unknown'}`
      );
    }
  }

  // Build PR history context
  const prLines = prRes.rows.map(p =>
    `PR #${p.pr_number} (${p.author}, ${new Date(p.pr_created_at).toLocaleDateString()}): "${p.title}" [${p.pr_state}]`
  );

  const gitContext = [
    gitLines.length > 0 ? 'FILE OWNERSHIP:\n' + gitLines.join('\n') : '',
    prLines.length > 0 ? 'RELATED PRs:\n' + prLines.join('\n') : '',
  ].filter(Boolean).join('\n\n');

  const answer = await claudeService.searchAnswer(query, codeContext, req.orgId!, gitContext || undefined);

  const MIN_SIMILARITY = 0.2;

  res.json({
    answer,
    sources: chunksRes.rows
      .filter(c => Number(c.similarity) >= MIN_SIMILARITY)
      .map(c => ({
        file:       c.file_path,
        line:       c.start_line,
        name:       c.name,
        owner:      c.primary_owner_name,
        bus_factor: c.bus_factor,
        incidents:  c.incident_count,
        similarity: Math.round(Number(c.similarity) * 100),
      })),
    related_prs: prRes.rows
      .filter(p => Number(p.similarity) >= MIN_SIMILARITY)
      .map(p => ({
        pr_number: p.pr_number,
        title:     p.title,
        state:     p.pr_state,
        date:      p.pr_created_at,
      })),
  });
};

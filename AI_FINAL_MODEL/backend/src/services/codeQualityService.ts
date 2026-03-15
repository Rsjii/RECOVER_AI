// PHASE2_DISABLED — Cyclomatic complexity + LOC tracking per file
// Not part of EngineeringOS Phase 1. Re-enable by setting PHASE2_ENABLED=true.

import { db } from '../config/db';
import { logger } from '../config/logger';

interface FileMetrics {
  filePath: string;
  linesOfCode: number;
  blankLines: number;
  commentLines: number;
  cyclomaticComplexity: number;
  functionCount: number;
  language: string;
}

function detectLanguage(ext: string): string {
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript',
    py: 'Python', go: 'Go', java: 'Java', rs: 'Rust', rb: 'Ruby',
    cs: 'C#', kt: 'Kotlin', php: 'PHP', swift: 'Swift',
  };
  return map[ext] || ext.toUpperCase() || 'Unknown';
}

function calculateMetrics(filePath: string, content: string): FileMetrics {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const language = detectLanguage(ext);
  const lines = content.split('\n');

  let blankLines = 0;
  let commentLines = 0;
  let cyclomaticComplexity = 1;
  let functionCount = 0;
  let inBlockComment = false;

  const isPython = language === 'Python';
  const isRuby   = language === 'Ruby';

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) { blankLines++; continue; }

    // Block comment tracking
    if (!inBlockComment) {
      if (!isPython && !isRuby && line.includes('/*')) {
        inBlockComment = true;
        commentLines++;
        if (line.includes('*/')) inBlockComment = false;
        continue;
      }
      if (isPython && (line.startsWith('"""') || line.startsWith("'''"))) {
        inBlockComment = true;
        commentLines++;
        const rest = line.slice(3);
        if (rest.includes('"""') || rest.includes("'''")) inBlockComment = false;
        continue;
      }
    } else {
      commentLines++;
      if (!isPython && !isRuby && line.includes('*/'))    inBlockComment = false;
      if (isPython  && (line.includes('"""') || line.includes("'''"))) inBlockComment = false;
      continue;
    }

    // Single-line comments
    if (
      (!isPython && !isRuby && (line.startsWith('//') || line.startsWith('*'))) ||
      ((isPython || isRuby) && line.startsWith('#'))
    ) {
      commentLines++;
      continue;
    }

    // Cyclomatic complexity branches
    const branchMatch = raw.match(/\b(if|else\s+if|elif|for|while|case|catch|&&|\|\|)\b/g);
    if (branchMatch) cyclomaticComplexity += branchMatch.length;

    // Function / method detection
    if (
      /\bfunction\s+\w+\s*\(/.test(raw) ||
      /(?:async\s+)?\w+\s*\([^)]*\)\s*(?:\{|=>)/.test(raw) ||
      /\bdef\s+\w+\s*\(/.test(raw) ||
      /\bfunc\s+\w+\s*\(/.test(raw) ||
      /\bfn\s+\w+\s*\(/.test(raw) ||
      /(?:public|private|protected|static)\s+\w[\w<>[\]]*\s+\w+\s*\(/.test(raw)
    ) {
      functionCount++;
    }
  }

  const linesOfCode = Math.max(0, lines.length - blankLines - commentLines);

  return { filePath, linesOfCode, blankLines, commentLines, cyclomaticComplexity, functionCount, language };
}

export const codeQualityService = {
  async snapshotRepo(repoId: string): Promise<void> {
    const snapshotDate = new Date();
    snapshotDate.setDate(1);
    snapshotDate.setHours(0, 0, 0, 0);
    const monthStr = snapshotDate.toISOString().split('T')[0];

    // Idempotent — skip if this month already done
    const existing = await db.query(
      `SELECT COUNT(*) FROM file_metrics WHERE repo_id = $1 AND snapshot_month = $2`,
      [repoId, monthStr]
    );
    if (Number(existing.rows[0].count) > 0) {
      logger.info(`[CodeQuality] Already have snapshot for repo ${repoId} month ${monthStr}`);
      return;
    }

    try {
      // Read file content from code_chunks (already stored during indexing)
      const filesRes = await db.query(
        `SELECT DISTINCT ON (file_path) file_path, content, language
         FROM code_chunks
         WHERE repo_id = $1 AND content IS NOT NULL
         ORDER BY file_path, id`,
        [repoId]
      );

      // Get git stats for age / last touch
      const gitStatsRes = await db.query(
        `SELECT file_path, file_age_days, last_commit_date
         FROM file_git_stats WHERE repo_id = $1`,
        [repoId]
      );
      const gitMap = new Map<string, any>(gitStatsRes.rows.map((r: any) => [r.file_path, r]));

      let totalComplexity = 0;
      let totalLoc = 0;
      let filesOver500 = 0;
      let filesOverC50 = 0;
      let fileCount = 0;

      for (const file of filesRes.rows) {
        try {
          const m = calculateMetrics(file.file_path, file.content || '');
          const git = gitMap.get(file.file_path) || {};

          await db.query(
            `INSERT INTO file_metrics
               (repo_id, file_path, snapshot_month, lines_of_code, blank_lines, comment_lines,
                cyclomatic_complexity, function_count, file_age_days, last_touch_date, language)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (repo_id, file_path, snapshot_month) DO NOTHING`,
            [
              repoId, m.filePath, monthStr,
              m.linesOfCode, m.blankLines, m.commentLines,
              m.cyclomaticComplexity, m.functionCount,
              git.file_age_days || 0,
              git.last_commit_date || null,
              m.language,
            ]
          ).catch(() => {});

          totalComplexity += m.cyclomaticComplexity;
          totalLoc += m.linesOfCode;
          if (m.linesOfCode > 500) filesOver500++;
          if (m.cyclomaticComplexity > 50) filesOverC50++;
          fileCount++;
        } catch { /* skip bad file */ }
      }

      if (fileCount > 0) {
        await db.query(
          `INSERT INTO repo_quality_summary
             (repo_id, snapshot_month, avg_complexity, total_files, total_loc, files_over_500_loc, files_over_complexity_50)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (repo_id, snapshot_month) DO UPDATE SET
             avg_complexity = EXCLUDED.avg_complexity,
             total_files = EXCLUDED.total_files,
             total_loc = EXCLUDED.total_loc,
             files_over_500_loc = EXCLUDED.files_over_500_loc,
             files_over_complexity_50 = EXCLUDED.files_over_complexity_50`,
          [repoId, monthStr, (totalComplexity / fileCount).toFixed(2), fileCount, totalLoc, filesOver500, filesOverC50]
        );
      }

      logger.info(`[CodeQuality] Snapshotted ${fileCount} files for repo ${repoId} (${monthStr})`);
    } catch (err: any) {
      logger.warn(`[CodeQuality] Snapshot failed for ${repoId}: ${err.message}`);
    }
  },
};

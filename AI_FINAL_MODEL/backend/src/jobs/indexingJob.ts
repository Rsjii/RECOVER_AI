// PHASE2_DISABLED — Code chunking + embedding indexing job (tree-sitter, OpenAI embeddings)
// Not part of EngineeringOS Phase 1. Re-enable by setting PHASE2_ENABLED=true.
// Note: gitHistoryService parts (bus factor, file stats) may still be reused in Phase 1.

import { Job } from 'bullmq';
import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { db } from '../config/db';
import { config } from '../config/env';
import { chunkingService } from '../services/chunkingService';
import { embeddingService } from '../services/embeddingService';
import { buildDependenciesFromImports } from '../services/dependencyService';
import { gitHistoryService } from '../services/gitHistoryService';
import { codeQualityService } from '../services/codeQualityService';
import { getOrgToken } from '../lib/octokitForOrg';
import { logger } from '../config/logger';

// ─── Full repo indexing job (runs once when repo is added) ────────────────────

export async function processIndexingJob(job: Job) {
  const { repoId, fullName, accessToken, orgId } = job.data;
  const tmpDir = path.join(os.tmpdir(), `cm_${repoId}_${Date.now()}`);

  try {
    await db.query(
      `UPDATE repositories SET status = 'indexing', indexing_progress = 5 WHERE id = $1`,
      [repoId]
    );

    // ── STEP 1: Clone ────────────────────────────────────────────────────────
    const cloneUrl = `https://x-access-token:${accessToken}@github.com/${fullName}.git`;
    const git = simpleGit();
    await git.clone(cloneUrl, tmpDir, ['--depth', '500']);
    await db.query(`UPDATE repositories SET indexing_progress = 15 WHERE id = $1`, [repoId]);

    // ── STEP 2: Parse files ──────────────────────────────────────────────────
    const allFiles = getAllFiles(tmpDir);
    logger.info(`[Indexing] ${fullName}: ${allFiles.length} files to process`);

    await db.query(`DELETE FROM code_chunks WHERE repo_id = $1`, [repoId]);
    await db.query(`DELETE FROM file_dependencies WHERE repo_id = $1`, [repoId]);

    const allChunks: any[] = [];
    const allImports: Array<{ sourceFile: string; targetFile: string; relationType: string }> = [];

    let processed = 0;
    for (let i = 0; i < allFiles.length; i += 10) {
      const batch = allFiles.slice(i, i + 10);
      await Promise.all(batch.map(async (filePath) => {
        try {
          const relPath = filePath.replace(tmpDir + path.sep, '').replace(/\\/g, '/');
          const content = fs.readFileSync(filePath, 'utf8');
          const chunks  = chunkingService.chunkFile(relPath, content);
          for (const chunk of chunks) allChunks.push({ ...chunk, repoId, orgId });
          allImports.push(...extractImports(content, relPath));
          processed++;
        } catch { /* skip bad files */ }
      }));

      const progress = 15 + Math.round((processed / allFiles.length) * 35);
      await db.query(
        `UPDATE repositories SET indexing_progress = $1 WHERE id = $2`,
        [progress, repoId]
      ).catch(() => {});
    }

    await db.query(`UPDATE repositories SET indexing_progress = 50 WHERE id = $1`, [repoId]);

    // ── STEP 3: Embed chunks ─────────────────────────────────────────────────
    let totalChunks = 0;
    const batchSize = 100;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch      = allChunks.slice(i, i + batchSize);
      const embeddings = await embeddingService.generateBatchEmbeddings(batch.map(c => c.content));

      await Promise.all(batch.map(async (chunk, j) => {
        const emb = embeddings[j].embedding;
        if (emb.length !== 1536) return;
        try {
          await db.query(
            `INSERT INTO code_chunks
               (repo_id, org_id, file_path, start_line, end_line, chunk_type, name, content, language, embedding)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::vector)`,
            [repoId, orgId, chunk.filePath, chunk.startLine, chunk.endLine,
             chunk.chunkType, chunk.functionName || null, chunk.content, chunk.language,
             `[${emb.join(',')}]`]
          );
          totalChunks++;
        } catch (e: any) { logger.warn(`[Indexing] chunk insert failed: ${e.message}`); }
      }));

      const progress = 50 + Math.round((i / allChunks.length) * 20);
      await db.query(
        `UPDATE repositories SET indexing_progress = $1 WHERE id = $2`,
        [Math.min(progress, 70), repoId]
      ).catch(() => {});
    }

    await db.query(`UPDATE repositories SET indexing_progress = 72 WHERE id = $1`, [repoId]);

    // ── STEP 4: Build dependency graph ──────────────────────────────────────
    await buildDependenciesFromImports(repoId, allImports);
    await db.query(`UPDATE repositories SET indexing_progress = 78 WHERE id = $1`, [repoId]);

    // ── STEP 5: Git history → churn, incidents, dates (commit-level) ─────────
    logger.info(`[Indexing] ${fullName}: parsing git history...`);
    await gitHistoryService.parseAndStore(repoId, tmpDir);
    await db.query(`UPDATE repositories SET indexing_progress = 84 WHERE id = $1`, [repoId]);

    // ── STEP 6: Historical PRs → fills pull_requests table ───────────────────
    logger.info(`[Indexing] ${fullName}: indexing historical PRs...`);
    await indexHistoricalPRs(repoId, orgId, fullName, accessToken);
    await db.query(`UPDATE repositories SET indexing_progress = 90 WHERE id = $1`, [repoId]);

    // ── STEP 6.5: PR-wise ownership → overwrites git-based ownership ──────────
    // Now that pull_requests is populated, compute who touched each file via PRs.
    // This is more meaningful than raw commit counts.
    logger.info(`[Indexing] ${fullName}: computing PR-wise file ownership...`);
    await gitHistoryService.computeOwnershipFromPRs(repoId);
    await db.query(`UPDATE repositories SET indexing_progress = 93 WHERE id = $1`, [repoId]);

        // ── STEP 7: Code Quality Snapshot ────────────────────────────────────────
    logger.info(`[Indexing] ${fullName}: computing code quality metrics...`);
    try {
      await codeQualityService.snapshotRepo(repoId);
    } catch (e: any) {
      logger.warn(`[Indexing] Code quality snapshot failed (non-fatal): ${e.message}`);
    }

    // ── STEP 7.5: Cross-repo dependency detection ─────────────────────────────
    // Detects which other org repos this repo depends on (package.json, imports)
    logger.info(`[Indexing] ${fullName}: detecting cross-repo dependencies...`);
    try {
      const { dependencyGraphService } = await import('../services/dependencyGraphService');
      await dependencyGraphService.detectAndStore(repoId, orgId);
    } catch (e: any) {
      logger.warn(`[Indexing] Dependency detection failed (non-fatal): ${e.message}`);
    }

    // ── STEP 8: Register webhook ──────────────────────────────────────────────
    const { githubService } = await import('../services/githubService');
    const webhookUrl = `${config.apiUrl}/webhooks/github/${repoId}`;
    try {
      let webhookId: string, webhookSecret: string;
      try {
        const { octokitForOrg } = await import('../lib/octokitForOrg');
        const appOctokit = await octokitForOrg(orgId);
        ({ id: webhookId, secret: webhookSecret } =
          await githubService.createWebhookWithOctokit(appOctokit, fullName, webhookUrl));
      } catch {
        ({ id: webhookId, secret: webhookSecret } =
          await githubService.createWebhook(accessToken, fullName, webhookUrl));
      }
      await db.query(
        `UPDATE repositories SET webhook_id = $1, webhook_secret = $2 WHERE id = $3`,
        [webhookId, webhookSecret, repoId]
      );
      logger.info(`[Indexing] Webhook registered for ${fullName}`);
    } catch (err: any) {
      logger.warn(`[Indexing] Webhook creation failed: ${err.message}`);
    }

    await db.query(
      `UPDATE repositories SET status = 'ready', indexing_progress = 100, indexed_at = NOW(), total_chunks = $1 WHERE id = $2`,
      [totalChunks, repoId]
    );
    logger.info(`[Indexing] ${fullName} complete: ${totalChunks} chunks`);
  } catch (err: any) {
    await db.query(
      `UPDATE repositories SET status = 'error', error_message = $1 WHERE id = $2`,
      [err.message, repoId]
    );
    throw err;
  } finally {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Partial re-index job (triggered on every PR merge) ───────────────────────
// Only re-indexes the files that changed in the merged PR.
// No full clone — fetches file content directly from GitHub API.

// ─── Partial re-index job (triggered on every PR merge) ───────────────────────

export async function processPartialReindexJob(job: Job) {
  const { repoId, orgId, repoFullName, prNumber } = job.data;

  try {
    const accessToken = await getOrgToken(orgId);
    const [owner, repo] = repoFullName.split('/');
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: accessToken });

    // ── Get changed files list ────────────────────────────────────────────────
    const prRes = await db.query(
      `SELECT files_changed FROM pull_requests WHERE repo_id = $1 AND pr_number = $2`,
      [repoId, prNumber]
    );

    let filePaths: string[] = [];

    if (prRes.rows.length > 0 && Array.isArray(prRes.rows[0].files_changed) && prRes.rows[0].files_changed.length > 0) {
      filePaths = prRes.rows[0].files_changed
        .map((f: any) => f.path || f.filename)
        .filter(Boolean);
    }

    // Fallback: PR not yet in DB → fetch file list from GitHub directly
    if (filePaths.length === 0) {
      logger.info(`[Reindex] PR #${prNumber} files not in DB — fetching from GitHub`);
      try {
        const filesRes = await octokit.pulls.listFiles({
          owner, repo, pull_number: prNumber, per_page: 100,
        });
        filePaths = filesRes.data.map((f: any) => f.filename);
      } catch (e: any) {
        logger.warn(`[Reindex] Could not fetch files for PR #${prNumber}: ${e.message}`);
        return;
      }
    }

    if (filePaths.length === 0) {
      logger.info(`[Reindex] No files to re-index for PR #${prNumber}`);
      return;
    }

    logger.info(`[Reindex] Re-indexing ${filePaths.length} files for merged PR #${prNumber} in ${repoFullName}`);

    // ── Process each changed file ─────────────────────────────────────────────
    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];

      // Rate limit: pause 500ms after every 5 file fetches (GitHub secondary rate limit)
      if (i > 0 && i % 5 === 0) {
        await new Promise(r => setTimeout(r, 500));
      }

      try {
        let content: string;
        try {
          const contentRes = await octokit.repos.getContent({ owner, repo, path: filePath });
          const data = contentRes.data as any;
          if (data.type !== 'file' || !data.content) continue;
          content = Buffer.from(data.content, 'base64').toString('utf8');
          if (content.length > 500_000) continue;
        } catch (e: any) {
          if (e.status === 404) {
            // File deleted in this PR — remove all its data
            await db.query(`DELETE FROM code_chunks WHERE repo_id = $1 AND file_path = $2`, [repoId, filePath]);
            await db.query(`DELETE FROM file_dependencies WHERE repo_id = $1 AND (source_file = $2 OR target_file = $2)`, [repoId, filePath]);
            await db.query(`DELETE FROM file_git_stats WHERE repo_id = $1 AND file_path = $2`, [repoId, filePath]);
            logger.info(`[Reindex] Removed data for deleted file: ${filePath}`);
          }
          continue;
        }

        const chunks = chunkingService.chunkFile(filePath, content);
        if (chunks.length === 0) continue;

        await db.query(`DELETE FROM code_chunks WHERE repo_id = $1 AND file_path = $2`, [repoId, filePath]);

        const embeddings = await embeddingService.generateBatchEmbeddings(chunks.map(c => c.content));

        await Promise.all(chunks.map(async (chunk, j) => {
          const emb = embeddings[j].embedding;
          if (emb.length !== 1536) return;
          await db.query(
            `INSERT INTO code_chunks
               (repo_id, org_id, file_path, start_line, end_line, chunk_type, name, content, language, embedding)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::vector)`,
            [repoId, orgId, chunk.filePath, chunk.startLine, chunk.endLine,
             chunk.chunkType, chunk.functionName || null, chunk.content, chunk.language,
             `[${emb.join(',')}]`]
          ).catch((e: any) => logger.warn(`[Reindex] chunk insert failed: ${e.message}`));
        }));

        const imports = extractImports(content, filePath);
        if (imports.length > 0) {
          await db.query(`DELETE FROM file_dependencies WHERE repo_id = $1 AND source_file = $2`, [repoId, filePath]);
          await Promise.all(imports.map(imp =>
            db.query(
              `INSERT INTO file_dependencies (repo_id, source_file, target_file, relation_type)
               VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
              [repoId, imp.sourceFile, imp.targetFile, imp.relationType]
            ).catch(() => {})
          ));
        }

        logger.info(`[Reindex] Updated: ${filePath} (${chunks.length} chunks)`);
      } catch (err: any) {
        logger.warn(`[Reindex] Skipped ${filePath}: ${err.message}`);
      }
    }

    // ── BUG FIX: Mark this PR as closed (it was merged) ──────────────────────
    await db.query(
      `UPDATE pull_requests SET pr_state = 'closed' WHERE repo_id = $1 AND pr_number = $2`,
      [repoId, prNumber]
    );

    // ── Recompute ownership + dashboard summary ───────────────────────────────
    await gitHistoryService.computeOwnershipFromPRs(repoId);
    await gitHistoryService.refreshRepoGitSummary(repoId);

    // ── Refresh code quality metrics for changed files (non-blocking) ─────────
    codeQualityService.snapshotRepo(repoId).catch((e: any) =>
      logger.warn(`[Reindex] Code quality refresh failed (non-fatal): ${e.message}`)
    );

    logger.info(`[Reindex] PR #${prNumber} partial re-index complete`);
  } catch (err: any) {
    logger.error({ err }, `[Reindex] Failed for repo ${repoId} PR #${prNumber}`);
    throw err;
  }
}


// ─── Historical PR indexing ────────────────────────────────────────────────────

async function indexHistoricalPRs(repoId: string, orgId: string, fullName: string, accessToken: string) {
  try {
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: accessToken });
    const [owner, repo] = fullName.split('/');

    const prs: any[] = [];
    for (let page = 1; page <= 2; page++) {
      const res = await octokit.pulls.list({ owner, repo, state: 'all', per_page: 100, page });
      prs.push(...res.data);
      if (res.data.length < 100) break;
    }

    logger.info(`[Indexing] ${fullName}: indexing ${prs.length} historical PRs`);

    let indexed = 0;
    const BATCH_SIZE = 10;

    for (let b = 0; b < prs.length; b += BATCH_SIZE) {
      const batch = prs.slice(b, b + BATCH_SIZE);

      for (const pr of batch) {
        try {
          let changedPaths: string[] = [];
          try {
            const filesRes = await octokit.pulls.listFiles({
              owner, repo, pull_number: pr.number, per_page: 100,
            });
            changedPaths = filesRes.data.map((f: any) => f.filename);
          } catch { /* skip */ }

          const embedText = `${pr.title} ${(pr.body || '').slice(0, 500)} ${changedPaths.join(' ')}`.slice(0, 2000);
          const { embedding } = await embeddingService.generateEmbedding(embedText);
          if (embedding.length !== 1536) continue;

          await db.query(
            `INSERT INTO pull_requests (
              repo_id, org_id, pr_number, title, author, body, github_pr_url, github_pr_id,
              files_changed, risk_level, risk_score, status, pr_state, pr_created_at,
              embedding, source
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'low',0,'analyzed',$10,$11,$12::vector,'historical')
            ON CONFLICT (repo_id, pr_number) DO NOTHING`,
            [
              repoId, orgId, pr.number,
              pr.title, pr.user?.login || 'unknown',
              (pr.body || '').slice(0, 2000),
              pr.html_url, String(pr.id),
              JSON.stringify(changedPaths.map(p => ({ path: p }))),
              pr.state, pr.created_at,
              `[${embedding.join(',')}]`,
            ]
          );
          indexed++;
        } catch { /* skip individual PR errors */ }
      }

      if (b + BATCH_SIZE < prs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    await db.query(
      `UPDATE repositories SET historical_prs_count = $1 WHERE id = $2`,
      [indexed, repoId]
    );
    logger.info(`[Indexing] Historical PRs indexed: ${indexed}`);
  } catch (err: any) {
    logger.warn(`[Indexing] Historical PR indexing failed: ${err.message}`);
  }
}

// ─── File utilities ───────────────────────────────────────────────────────────

function getAllFiles(dir: string): string[] {
  const EXTENSIONS = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.py', '.go',
    '.java', '.rs', '.rb', '.cs', '.kt', '.php', '.swift',
  ]);
  const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '__pycache__', '.next',
    'vendor', 'target', 'coverage', '.cache', 'out', 'tmp', '.tmp',
    'test', 'tests', '__tests__', '__mocks__', 'e2e', 'cypress',
    'playwright', '.storybook', 'storybook-static', 'generated',
    'public', 'static', 'assets', '.turbo', '.vercel',
  ]);
  const MAX_FILE_BYTES = 500_000;

  const results: string[] = [];
  const walk = (current: string) => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); }
    catch { return; }

    for (const e of entries) {
      if (IGNORE_DIRS.has(e.name)) continue;
      const full = path.join(current, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!e.isFile()) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (!EXTENSIONS.has(ext)) continue;
      if (e.name.endsWith('.d.ts')) continue;
      if (e.name.includes('.min.')) continue;
      try {
        const stat = fs.statSync(full);
        if (stat.size > MAX_FILE_BYTES) continue;
      } catch { continue; }
      results.push(full);
    }
  };

  walk(dir);
  return results;
}

function extractImports(content: string, filePath: string) {
  const imports: Array<{ sourceFile: string; targetFile: string; relationType: string }> = [];
  const importRe = /(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
  let m;
  while ((m = importRe.exec(content)) !== null) {
    const t = m[1] || m[2];
    if (t && (t.startsWith('./') || t.startsWith('../'))) {
      imports.push({ sourceFile: filePath, targetFile: t, relationType: 'imports' });
    }
  }
  const pyRe = /from\s+(\.+[\w.]*)\s+import/g;
  while ((m = pyRe.exec(content)) !== null) {
    imports.push({ sourceFile: filePath, targetFile: m[1], relationType: 'imports' });
  }
  return imports;
}

import { db } from '../config/db';
import { logger } from '../config/logger';

export const dependencyGraphService = {

  // ── Called after full index. Scans chunks for cross-repo dependencies. ────────
  async detectAndStore(repoId: string, orgId: string): Promise<void> {
    try {
      // Get all other repos in this org — build slug → id lookup
      const orgRepos = await db.query(
        `SELECT id, full_name FROM repositories WHERE org_id = $1 AND id != $2`,
        [orgId, repoId]
      );
      if (orgRepos.rows.length === 0) return;

      const slugToId = new Map<string, string>();
      for (const r of orgRepos.rows) {
        const [, name] = (r.full_name as string).split('/');
        slugToId.set(name.toLowerCase(), r.id);
        slugToId.set((r.full_name as string).toLowerCase(), r.id);
      }

      const found = new Map<string, { targetRepoId: string; pkg: string; type: string; files: string[] }>();

      // Source 1: package.json — highest confidence
      const pkgRows = await db.query(
        `SELECT content FROM code_chunks WHERE repo_id = $1 AND file_path LIKE '%package.json' LIMIT 3`,
        [repoId]
      );
      for (const row of pkgRows.rows) {
        try {
          const pkg = JSON.parse(row.content as string);
          const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
          for (const pkgName of Object.keys(allDeps || {})) {
            const bare = pkgName.replace(/^@[^/]+\//, '');
            const targetId = slugToId.get(bare.toLowerCase()) ?? slugToId.get(pkgName.toLowerCase());
            if (targetId && !found.has(targetId)) {
              found.set(targetId, { targetRepoId: targetId, pkg: pkgName, type: 'npm_package', files: ['package.json'] });
            }
          }
        } catch { /* skip bad JSON */ }
      }

      // Source 2: import paths in code chunks — medium confidence
      const importRe = /(?:from|require)\s*\(?['"]((?:@[^/'"]+\/)?[^.'"\/][^'"]*)['"]\)?/g;
      const chunkRows = await db.query(
        `SELECT file_path, content FROM code_chunks WHERE repo_id = $1 LIMIT 300`,
        [repoId]
      );
      const importFileMap = new Map<string, string[]>();
      for (const row of chunkRows.rows) {
        let m;
        while ((m = importRe.exec(row.content as string)) !== null) {
          const imp = m[1];
          const bare = imp.replace(/^@[^/]+\//, '').split('/')[0];
          const targetId = slugToId.get(bare.toLowerCase()) ?? slugToId.get(imp.toLowerCase());
          if (targetId) {
            if (!importFileMap.has(targetId)) importFileMap.set(targetId, []);
            importFileMap.get(targetId)!.push(row.file_path as string);
          }
        }
      }
      for (const [targetId, files] of importFileMap.entries()) {
        if (!found.has(targetId)) {
          const uniqueFiles = [...new Set(files)].slice(0, 8);
          // Find the package name from slug
          const pkg = [...slugToId.entries()].find(([, id]) => id === targetId)?.[0] ?? targetId;
          found.set(targetId, { targetRepoId: targetId, pkg, type: 'import_path', files: uniqueFiles });
        }
      }

      // Persist
      await db.query(`DELETE FROM repo_dependencies WHERE source_repo_id = $1`, [repoId]);
      for (const dep of found.values()) {
        const confidence = dep.type === 'npm_package' ? 0.95 : 0.72;
        await db.query(
          `INSERT INTO repo_dependencies
             (org_id, source_repo_id, target_repo_id, target_package, dependency_type, detected_files, confidence)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
           ON CONFLICT (source_repo_id, target_repo_id, target_package) DO UPDATE SET
             detected_files   = EXCLUDED.detected_files,
             confidence       = EXCLUDED.confidence,
             last_detected_at = NOW()`,
          [orgId, repoId, dep.targetRepoId, dep.pkg, dep.type, JSON.stringify(dep.files), confidence]
        );
      }

      logger.info(`[DepGraph] ${found.size} cross-repo deps stored for repo ${repoId}`);
    } catch (err: any) {
      logger.error({ err }, `[DepGraph] detectAndStore failed for repo ${repoId}`);
    }
  },

  // ── Full org dependency graph ─────────────────────────────────────────────────
  async getOrgGraph(orgId: string) {
    const [repos, edges] = await Promise.all([
      db.query(
        `SELECT r.id, r.full_name, r.status, r.historical_prs_count,
                (SELECT COUNT(*) FROM pull_requests WHERE repo_id = r.id) as pr_count,
                gs.avg_bus_factor, gs.knowledge_silo_count
         FROM repositories r
         LEFT JOIN repo_git_summary gs ON gs.repo_id = r.id
         WHERE r.org_id = $1
         ORDER BY r.full_name`,
        [orgId]
      ),
      db.query(
        `SELECT d.source_repo_id, d.target_repo_id, d.target_package,
                d.dependency_type, d.confidence, d.detected_files,
                r1.full_name as source_name, r2.full_name as target_name
         FROM repo_dependencies d
         JOIN repositories r1 ON r1.id = d.source_repo_id
         JOIN repositories r2 ON r2.id = d.target_repo_id
         WHERE d.org_id = $1 AND d.confidence >= 0.70
         ORDER BY d.confidence DESC`,
        [orgId]
      ),
    ]);
    return { repos: repos.rows, edges: edges.rows };
  },

  // ── Cross-repo impact: which repos are affected by a PR ───────────────────────
  async getCrossRepoImpact(prId: string) {
    const prRes = await db.query(
      `SELECT pr.repo_id, pr.files_changed, r.full_name, r.org_id
       FROM pull_requests pr JOIN repositories r ON r.id = pr.repo_id
       WHERE pr.id = $1`, [prId]
    );
    if (!prRes.rows.length) return [];

    const { repo_id: repoId, org_id: orgId } = prRes.rows[0];

    const deps = await db.query(
      `SELECT d.source_repo_id as dep_id, d.target_package, d.dependency_type, d.detected_files,
              r.full_name as dep_name
       FROM repo_dependencies d JOIN repositories r ON r.id = d.source_repo_id
       WHERE d.target_repo_id = $1`,
      [repoId]
    );
    if (!deps.rows.length) return [];

    const impacts = [];
    for (const dep of deps.rows) {
      const ownerRes = await db.query(
        `SELECT primary_owner_email, primary_owner_pct
         FROM file_git_stats WHERE repo_id = $1
         ORDER BY knowledge_risk_score DESC LIMIT 1`,
        [dep.dep_id]
      );
      impacts.push({
        repo_id:          dep.dep_id,
        repo_name:        dep.dep_name,
        dependency_type:  dep.dependency_type,
        target_package:   dep.target_package,
        detected_files:   dep.detected_files,
        top_owner:        ownerRes.rows[0]?.primary_owner_email ?? null,
        top_owner_pct:    ownerRes.rows[0]?.primary_owner_pct ?? 0,
      });
    }
    return impacts;
  },

  // ── Expert finder across all org repos ───────────────────────────────────────
  async findExperts(orgId: string, topic: string) {
    const like = `%${topic.toLowerCase()}%`;

    const rows = await db.query(
      `SELECT fgs.primary_owner_email as login,
              fgs.primary_owner_name as name,
              fgs.primary_owner_pct as pct,
              fgs.file_path,
              r.full_name as repo_name
       FROM file_git_stats fgs
       JOIN repositories r ON r.id = fgs.repo_id
       WHERE r.org_id = $1
         AND LOWER(fgs.file_path) LIKE $2
         AND fgs.primary_owner_email IS NOT NULL
         AND fgs.primary_owner_email NOT IN ('unknown','')
       ORDER BY fgs.primary_owner_pct DESC
       LIMIT 100`,
      [orgId, like]
    );

    const map = new Map<string, { login: string; name: string; score: number; files: any[]; repos: Set<string> }>();
    for (const r of rows.rows) {
      if (!map.has(r.login)) map.set(r.login, { login: r.login, name: r.name, score: 0, files: [], repos: new Set() });
      const e = map.get(r.login)!;
      e.score += Number(r.pct);
      e.files.push({ repo: r.repo_name, file: r.file_path, pct: Number(r.pct) });
      e.repos.add(r.repo_name);
    }

    const experts = [...map.values()]
      .map(e => ({
        login:       e.login,
        name:        e.name,
        score:       Math.min(Math.round(e.score / Math.max(e.files.length, 1)), 100),
        total_files: e.files.length,
        repos:       [...e.repos],
        top_files:   e.files.slice(0, 6),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const relatedFiles = await db.query(
      `SELECT DISTINCT cc.file_path, r.full_name as repo_name, fgs.primary_owner_email as owner
       FROM code_chunks cc
       JOIN repositories r ON r.id = cc.repo_id
       LEFT JOIN file_git_stats fgs ON fgs.repo_id = cc.repo_id AND fgs.file_path = cc.file_path
       WHERE r.org_id = $1 AND LOWER(cc.file_path) LIKE $2
       LIMIT 15`,
      [orgId, like]
    );

    return { experts, related_files: relatedFiles.rows };
  },
};

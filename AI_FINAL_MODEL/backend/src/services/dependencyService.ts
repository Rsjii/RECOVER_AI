// PHASE2_DISABLED — Cross-repo dependency detection (import/package analysis)
// Not part of EngineeringOS Phase 1. Re-enable by setting PHASE2_ENABLED=true.

import { db } from '../config/db';
import { AffectedService } from '../types';

async function getAffectedServices(repoId: string, changedFiles: string[]): Promise<AffectedService[]> {
  if (changedFiles.length === 0) return [];

  const placeholders = changedFiles.map((_, i) => `$${i + 2}`).join(',');

  // Find files that import/depend on any of the changed files
  const res = await db.query(
    `SELECT DISTINCT source_file, relation_type, strength
     FROM file_dependencies
     WHERE repo_id = $1
       AND (target_file = ANY($2) OR source_file = ANY($2))
     ORDER BY strength DESC`,
    [repoId, changedFiles]
  );

  // De-duplicate and group, assigning risk based on strength
  const seen = new Set<string>();
  const services: AffectedService[] = [];

  for (const row of res.rows) {
    const filePath = changedFiles.includes(row.source_file) ? row.source_file : row.source_file;
    const key = row.source_file;
    if (seen.has(key) || changedFiles.includes(key)) continue;
    seen.add(key);

    let risk_level: AffectedService['risk_level'] = 'low';
    if (row.strength >= 8) risk_level = 'critical';
    else if (row.strength >= 6) risk_level = 'high';
    else if (row.strength >= 4) risk_level = 'medium';

    services.push({
      service_path: row.source_file,
      risk_level,
      relation_type: row.relation_type || 'imports',
    });
  }

  return services.slice(0, 10); // cap at 10
}

async function buildDependenciesFromImports(
  repoId: string,
  imports: Array<{ sourceFile: string; targetFile: string; relationType: string }>
): Promise<void> {
  // Delete old deps for this repo
  await db.query(`DELETE FROM file_dependencies WHERE repo_id = $1`, [repoId]);

  if (imports.length === 0) return;

  // Batch insert
  const batchSize = 500;
  for (let i = 0; i < imports.length; i += batchSize) {
    const batch = imports.slice(i, i + batchSize);
    const values = batch.map((_, j) => {
      const base = j * 3;
      return `($1, $${base + 2}, $${base + 3}, $${base + 4})`;
    }).join(',');

    const params: any[] = [repoId];
    batch.forEach(imp => params.push(imp.sourceFile, imp.targetFile, imp.relationType));

    await db.query(
      `INSERT INTO file_dependencies (repo_id, source_file, target_file, relation_type)
       VALUES ${values} ON CONFLICT DO NOTHING`,
      params
    );
  }
}

// Export object for analysisService
export const dependencyService = {
  getAffectedServices,
};

// Export functions individually for indexingJob
export { getAffectedServices, buildDependenciesFromImports };

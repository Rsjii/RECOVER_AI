// PHASE2_DISABLED — PR analysis job (Claude PR review, risk scoring, GitHub comments)
// Not part of EngineeringOS Phase 1. Re-enable by setting PHASE2_ENABLED=true.

import { Job } from 'bullmq';
import { analysisService } from '../services/analysisService';
import { logger } from '../config/logger';

export async function processAnalysisJob(job: Job) {
  const { repoId, orgId, prNumber, repoFullName } = job.data;
  logger.info(`[Analysis] Starting PR #${prNumber} in ${repoFullName}`);
  await analysisService.analyzePR({ repoId, orgId, prNumber, repoFullName });
}

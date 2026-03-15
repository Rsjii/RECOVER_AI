// PHASE2_DISABLED — PR risk scoring (file criticality, change size, ownership)
// Not part of EngineeringOS Phase 1. Re-enable by setting PHASE2_ENABLED=true.

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskInput {
  filesChanged: number;
  totalLinesChanged: number;
  totalLinesInFiles: number;
  servicesAffected: number;
  historicalIncidents: number;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
}

export function calculateRisk(input: RiskInput): RiskResult {
  const { filesChanged, totalLinesChanged, totalLinesInFiles, servicesAffected, historicalIncidents } = input;

  let filesScore = 0;
  if (filesChanged >= 7) filesScore = 40;
  else if (filesChanged >= 4) filesScore = 25;
  else if (filesChanged >= 2) filesScore = 15;
  else filesScore = 5;

  let servicesScore = 0;
  if (servicesAffected >= 4) servicesScore = 45;
  else if (servicesAffected >= 2) servicesScore = 30;
  else if (servicesAffected === 1) servicesScore = 15;

  let historicalScore = 0;
  if (historicalIncidents >= 3) historicalScore = 30;
  else if (historicalIncidents >= 1) historicalScore = 15;

  let churnScore = 0;
  if (totalLinesInFiles > 0) {
    const churnRatio = totalLinesChanged / totalLinesInFiles;
    if (churnRatio >= 0.3) churnScore = 20;
    else if (churnRatio >= 0.1) churnScore = 10;
  }

  const score = Math.min(filesScore + servicesScore + historicalScore + churnScore, 100);

  let level: RiskLevel;
  if (score >= 76) level = 'critical';
  else if (score >= 51) level = 'high';
  else if (score >= 26) level = 'medium';
  else level = 'low';

  return { score, level };
}

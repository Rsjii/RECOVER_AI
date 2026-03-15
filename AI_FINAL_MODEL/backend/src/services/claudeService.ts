import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { AffectedService, SimilarPR, FileChanged, Recommendation } from '../types';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

export interface AnalysisResult {
  aiAnalysis: string;
  recommendations: Recommendation[];
}

export const claudeService = {
  async generatePRAnalysis(data: {
    prTitle: string;
    prAuthor: string;
    prBody: string | null;
    filesChanged: FileChanged[];
    affectedServices: AffectedService[];
    similarPRs: SimilarPR[];
    riskLevel: string;
    riskScore: number;
    fileGitStats?: any[];
    patchSummary?: string;   // actual added code lines from the PR diff
  }): Promise<AnalysisResult> {
    const filesText = data.filesChanged.slice(0, 10).map(f => {
      const gs = data.fileGitStats?.find((s: any) => s.file_path === f.path);
      let extra = '';
      if (gs) {
        extra = ` [Bus:${gs.bus_factor}, Incidents:${gs.incident_count}, Reverts:${gs.revert_count}]`;
      }
      return `- ${f.path} (+${f.additions}/-${f.deletions})${extra}`;
    }).join('\n');

    const gitContext = data.fileGitStats && data.fileGitStats.length > 0
      ? `\nGIT HISTORY INSIGHTS:\n` + data.fileGitStats.slice(0, 5).map((s: any) =>
          `- ${s.file_path}: bus_factor=${s.bus_factor}, incidents=${s.incident_count}, reverts=${s.revert_count}, ` +
          `primary_owner=${s.primary_owner_name || 'unknown'}, last_touched=${s.file_age_days}d ago`
        ).join('\n')
      : '';

    const servicesText = data.affectedServices.length > 0
      ? data.affectedServices.map(s => `- ${s.service_path} (${s.risk_level})`).join('\n')
      : 'None detected';

    const historyText = data.similarPRs.length > 0
      ? data.similarPRs.slice(0, 3).map(p =>
          `- PR #${p.pr_number}: "${p.title}" → ${p.outcome} (${new Date(p.pr_created_at).toLocaleDateString()})`
        ).join('\n')
      : 'No similar past PRs';

    // Actual code diff — gives Claude specific context about what changed
    const patchSection = data.patchSummary && data.patchSummary.trim().length > 0
      ? `\nACTUAL CODE CHANGES (added lines, top files):\n${data.patchSummary}`
      : '';

    const prompt = `You are a senior engineering advisor with deep institutional knowledge. Analyze this GitHub PR.

PR: ${data.prTitle}
Author: ${data.prAuthor}
Risk: ${data.riskLevel.toUpperCase()} (${data.riskScore}/100)

FILES CHANGED:
${filesText}
${gitContext}${patchSection}

AFFECTED SERVICES:
${servicesText}

SIMILAR PAST PRs:
${historyText}

PR DESCRIPTION:
${data.prBody ? data.prBody.substring(0, 500) : 'No description'}

Provide JSON with exactly:
{
  "analysis": "2-3 sentences. Reference specific file names, actual code patterns from the diff, bus factors, past incidents, or ownership risks if present. Be concrete.",
  "recommendations": [
    "Specific recommendation referencing actual code or file names from the diff",
    "Another specific recommendation",
    "Third recommendation"
  ]
}

If bus_factor=1 on any file, call it out. If actual code changes show risky patterns (no error handling, direct DB queries, auth changes), mention them specifically.`;

    try {
      const msg = await client.messages.create({
        model:      'claude-sonnet-4-6',
        max_tokens: 700,
        messages:   [{ role: 'user', content: prompt }],
      });
      const text  = msg.content[0].type === 'text' ? msg.content[0].text : '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON');
      const parsed = JSON.parse(match[0]);
      return {
        aiAnalysis:      parsed.analysis || 'Analysis unavailable.',
        recommendations: (parsed.recommendations || []).map((r: string) => ({ text: r })),
      };
    } catch (err: any) {
      logger.error({ err }, '[Claude] PR analysis error');
      return {
        aiAnalysis:      'Analysis could not be generated.',
        recommendations: [{ text: 'Review changed files carefully before merging.' }],
      };
    }
  },

  async searchAnswer(query: string, context: string, orgId: string, gitContext?: string): Promise<string> {
    try {
      const fullContext = gitContext
        ? `${context}\n\n--- GIT HISTORY CONTEXT ---\n${gitContext}`
        : context;

      const msg = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role:    'user',
          content: `You are a codebase expert with access to both code structure AND git history.
Answer the question based on all provided context.

QUESTION: ${query}

CODE & GIT CONTEXT:
${fullContext.substring(0, 7000)}

Answer specifically. If git history shows ownership ("only X knows this"), mention it.
Reference file paths, authors, and dates when relevant. Be direct and helpful.`,
        }],
      });
      return msg.content[0].type === 'text' ? msg.content[0].text : 'Could not generate answer.';
    } catch (err: any) {
      logger.error({ err }, '[Claude] Search error');
      return 'Search is temporarily unavailable.';
    }
  },
};

import { Octokit } from '@octokit/rest';
import { GitHubFile } from '../types/github';
import { logger } from '../config/logger';
import { config } from '../config/env';
import crypto from 'crypto';

export class GitHubService {
  private getOctokit(accessToken: string) {
    return new Octokit({ auth: accessToken });
  }

  async fetchPRFiles(accessToken: string, owner: string, repo: string, prNumber: number): Promise<GitHubFile[]> {
    const octokit = this.getOctokit(accessToken);
    const res = await octokit.pulls.listFiles({ owner, repo, pull_number: prNumber, per_page: 100 });
    return res.data as GitHubFile[];
  }

  async fetchPRDetails(accessToken: string, owner: string, repo: string, prNumber: number) {
    const octokit = this.getOctokit(accessToken);
    const res = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
    return res.data;
  }

  async postComment(accessToken: string, owner: string, repo: string, prNumber: number, body: string): Promise<string> {
    const octokit = this.getOctokit(accessToken);
    const res = await octokit.issues.createComment({ owner, repo, issue_number: prNumber, body });
    return String(res.data.id);
  }

  async updateComment(accessToken: string, owner: string, repo: string, commentId: string, body: string): Promise<void> {
    const octokit = this.getOctokit(accessToken);
    await octokit.issues.updateComment({ owner, repo, comment_id: Number(commentId), body });
  }

  async createWebhook(accessToken: string, fullName: string, webhookUrl: string): Promise<{ id: string; secret: string }> {
    const [owner, repo] = fullName.split('/');
    const secret = crypto.randomBytes(20).toString('hex');
    const octokit = this.getOctokit(accessToken);
    const res = await octokit.repos.createWebhook({
      owner, repo,
      config: { url: webhookUrl, content_type: 'json', secret, insecure_ssl: '0' },
      events: ['pull_request'],
      active: true,
    });
    return { id: String(res.data.id), secret };
  }

  async createWebhookWithOctokit(octokit: Octokit, fullName: string, webhookUrl: string): Promise<{ id: string; secret: string }> {
    const [owner, repo] = fullName.split('/');
    const secret = crypto.randomBytes(20).toString('hex');
    const res = await octokit.repos.createWebhook({
      owner, repo,
      config: { url: webhookUrl, content_type: 'json', secret, insecure_ssl: '0' },
      events: ['pull_request'],
      active: true,
    });
    return { id: String(res.data.id), secret };
  }

  async deleteWebhook(accessToken: string, fullName: string, webhookId: string): Promise<void> {
    const [owner, repo] = fullName.split('/');
    const octokit = this.getOctokit(accessToken);
    await octokit.repos.deleteWebhook({ owner, repo, hook_id: Number(webhookId) });
  }

  formatComment(data: {
    prNumber: number;
    prTitle: string;
    riskLevel: string;
    riskScore: number;
    filesChanged: Array<{ path: string; additions: number; deletions: number }>;
    affectedServices: Array<{ service_path: string; risk_level: string }>;
    similarPRs: Array<{ pr_number: number; title: string; outcome: string; pr_created_at: string }>;
    aiAnalysis: string;
    recommendations: Array<{ text: string }>;
    fileGitStats: Record<string, any>;
    suggestedReviewers: Array<{ email: string; name: string; reason: string; ownership_pct?: number }>;
    duplicateFindings: Array<{ file_path: string; similarity: number; content_preview: string }>;
    dashboardUrl: string;
    prId: string;
  }): string {
    const riskEmoji = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[data.riskLevel] || '⚪';
    const riskLabel = data.riskLevel.toUpperCase();

    // Files section
    const filesSection = data.filesChanged.slice(0, 8).map(f => {
      const gs = data.fileGitStats[f.path];
      let gitLine = '';
      if (gs) {
        const busIcon  = gs.bus_factor === 1 ? '🚨' : gs.bus_factor === 2 ? '⚠️' : '👥';
        const churnLbl = gs.churn_score > 60 ? 'HIGH' : gs.churn_score > 30 ? 'MED' : 'LOW';
        gitLine = `\n  → ${busIcon} Bus:${gs.bus_factor} | Churn:${churnLbl}` +
          (gs.incident_count > 0 ? ` | ⚠️ ${gs.incident_count} past incident${gs.incident_count > 1 ? 's' : ''}` : '') +
          (gs.bus_factor === 1 && gs.primary_owner_name ? ` | Only known by: **${gs.primary_owner_name}**` : '');
      }
      return `\`${f.path}\` (+${f.additions}/-${f.deletions})${gitLine}`;
    }).join('\n');

    // Affected services
    const servicesSection = data.affectedServices.length > 0
      ? data.affectedServices.slice(0, 6).map(s => {
          const e = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[s.risk_level] || '⚪';
          return `${e} \`${s.service_path}\``;
        }).join('\n')
      : '*No direct service dependencies found*';

    // Historical PRs
    const historySection = data.similarPRs.length > 0
      ? data.similarPRs.slice(0, 3).map(p => {
          const icon = p.outcome === 'succeeded' ? '✅' : p.outcome === 'closed' ? '⚠️' : '❓';
          const date = new Date(p.pr_created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          return `${icon} ${date} — PR #${p.pr_number} — ${p.title.substring(0, 60)}`;
        }).join('\n')
      : '*No similar past PRs found*';

    // Suggested reviewers (enhanced)
    const reviewersSection = data.suggestedReviewers.length > 0
      ? data.suggestedReviewers.map((r, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
          const pctStr = r.ownership_pct ? ` (${r.ownership_pct}% ownership)` : '';
          return `${medal} **${r.name}**${pctStr} — ${r.reason}`;
        }).join('\n')
      : '*No reviewer suggestions (index repo to get smart suggestions)*';

    // Code duplication section
    const duplicateSection = data.duplicateFindings.length > 0
      ? `\n**🔍 SIMILAR CODE FOUND:**\n` +
        data.duplicateFindings.map(d =>
          `→ ${d.similarity}% match — \`${d.file_path}\``
        ).join('\n') +
        '\n*Consider reusing existing implementations instead of adding new code.*'
      : '';

    // Recommendations
    const recsSection = data.recommendations.slice(0, 4).map((r, i) => `${i + 1}. ${r.text}`).join('\n');

    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**PR IMPACT ANALYSIS** — #${data.prNumber}
${data.prTitle}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${riskEmoji} **${riskLabel} RISK** (score: ${data.riskScore}/100)

**📁 FILES CHANGED (${data.filesChanged.length}):**
${filesSection}

**📡 AFFECTED SERVICES:**
${servicesSection}

**🕰️ HISTORICAL CONTEXT:**
${historySection}

**🤖 AI ANALYSIS:**
${data.aiAnalysis}

**✅ RECOMMENDATIONS:**
${recsSection}

**👥 SUGGESTED REVIEWERS:**
${reviewersSection}${duplicateSection}

🔗 [View full analysis & team notes](${data.dashboardUrl}/prs/${data.prId})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*Powered by Codebase Memory — Institutional Intelligence for Engineering Teams*`;
  }
}

export const githubService = new GitHubService();

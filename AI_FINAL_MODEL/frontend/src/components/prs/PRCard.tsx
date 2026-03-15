import { useNavigate } from 'react-router-dom';
import { ExternalLink, FileCode, GitPullRequest } from 'lucide-react';
import RiskBadge from './RiskBadge';
import { timeAgo } from '../../lib/utils';

const RISK_BORDER: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-green-500',
};

interface PR {
  id: string;
  pr_number: number;
  title: string;
  author: string;
  risk_level: string;
  repo_full_name: string;
  files_changed: any[];
  affected_services: any[];
  github_pr_url: string;
  pr_created_at: string;
}

export default function PRCard({ pr }: { pr: PR }) {
  const navigate = useNavigate();
  const borderColor = RISK_BORDER[pr.risk_level] || 'border-l-slate-600';

  return (
    <div
      onClick={() => navigate(`/prs/${pr.id}`)}
      className={`bg-[#0d1424] border border-slate-800 border-l-2 ${borderColor} rounded-xl p-4 hover:border-slate-700 hover:bg-[#111827] transition-all duration-150 cursor-pointer group`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Top row */}
          <div className="flex items-center gap-2 mb-2">
            <RiskBadge level={pr.risk_level} />
            <span className="text-slate-600 text-xs font-mono">#{pr.pr_number}</span>
            <span className="text-slate-700 text-xs">·</span>
            <span className="text-slate-500 text-xs">{pr.repo_full_name}</span>
          </div>

          {/* Title */}
          <h3 className="text-slate-200 font-medium group-hover:text-white transition-colors leading-snug line-clamp-1">
            {pr.title}
          </h3>

          {/* Meta */}
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
              <img src={`https://github.com/${pr.author}.png?size=16`} className="w-4 h-4 rounded-full" alt="" />
              {pr.author}
            </div>
            <div className="flex items-center gap-1 text-slate-600 text-xs">
              <FileCode size={11} />
              {pr.files_changed?.length || 0} files
            </div>
            <div className="flex items-center gap-1 text-slate-600 text-xs">
              <GitPullRequest size={11} />
              {pr.affected_services?.length || 0} services
            </div>
            <span className="text-slate-700 text-xs ml-auto">{timeAgo(pr.pr_created_at)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 pt-0.5" onClick={e => e.stopPropagation()}>
          {pr.github_pr_url && (
            <a
              href={pr.github_pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-600 hover:text-slate-300 rounded-lg hover:bg-white/5 transition-colors"
            >
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

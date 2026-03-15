export interface User {
  id: string;
  github_id: string;
  github_username: string;
  email: string | null;
  avatar_url: string | null;
  access_token: string | null;
  org_id: string | null;
  created_at: Date;
}

export interface Organization {
  id: string;
  github_org_id: string | null;
  github_org_name: string;
  created_by: string;
  created_at: Date;
}

export interface TeamMember {
  id: string;
  user_id: string;
  org_id: string;
  role: 'admin' | 'reviewer' | 'developer';
  joined_at: Date;
  // joined fields
  github_username?: string;
  email?: string;
  avatar_url?: string;
}

export interface Invite {
  id: string;
  org_id: string;
  email: string;
  token: string;
  role: 'admin' | 'reviewer' | 'developer';
  invited_by: string;
  expires_at: Date;
  accepted_at: Date | null;
  created_at: Date;
}

export interface Repository {
  id: string;
  org_id: string;
  github_repo_id: string;
  full_name: string;
  default_branch: string;
  webhook_id: string | null;
  webhook_secret: string | null;
  status: 'pending' | 'indexing' | 'ready' | 'error';
  indexing_progress: number;
  indexed_at: Date | null;
  total_chunks: number;
  error_message: string | null;
  created_at: Date;
}

export interface PullRequest {
  id: string;
  repo_id: string;
  org_id: string;
  pr_number: number;
  github_pr_id: string | null;
  title: string;
  author: string | null;
  body: string | null;
  github_pr_url: string | null;
  files_changed: FileChanged[] | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  affected_services: AffectedService[] | null;
  similar_prs: SimilarPR[] | null;
  ai_analysis: string | null;
  recommendations: Recommendation[] | null;
  github_comment_id: string | null;
  status: 'pending' | 'analyzing' | 'analyzed' | 'failed';
  pr_state: string | null;
  pr_created_at: Date | null;
  analyzed_at: Date | null;
}

export interface FileChanged {
  path: string;
  additions: number;
  deletions: number;
  changes: number;
}

export interface AffectedService {
  service_path: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  relation_type: string;
}

export interface SimilarPR {
  pr_number: number;
  title: string;
  outcome: 'succeeded' | 'failed' | 'unknown';
  similarity_score: number;
  pr_created_at: string;
}

export interface Recommendation {
  text: string;
}

export interface Subscription {
  id: string;
  org_id: string;
  tier: string;
  status: 'active' | 'cancelled' | 'past_due';
  lemonsqueezy_subscription_id: string | null;
  lemonsqueezy_customer_id: string | null;
  price_monthly: number | null;
  current_period_end: Date | null;
}

// Express augment
import { Request } from 'express';
export interface AuthRequest extends Request {
  userId?: string;
  orgId?: string;
  user?: User & { role: string };
}

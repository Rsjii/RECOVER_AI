export interface GitHubPRWebhookPayload {
  action: 'opened' | 'closed' | 'synchronize' | 'reopened' | string;
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: 'open' | 'closed';
    merged: boolean;
    html_url: string;
    user: {
      login: string;
      avatar_url: string;
    };
    head: {
      sha: string;
      ref: string;
    };
    base: {
      sha: string;
      ref: string;
      repo: {
        id: number;
        full_name: string;
        default_branch: string;
      };
    };
    additions: number;
    deletions: number;
    changed_files: number;
    created_at: string;
    updated_at: string;
  };
  repository: {
    id: number;
    full_name: string;
    private: boolean;
  };
  installation?: {
    id: number;
  };
}

export interface GitHubFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface PullRequest {
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string;
  url: string;
  sourceBranch: string;
  targetBranch: string;
  mergeable?: boolean|null;
}

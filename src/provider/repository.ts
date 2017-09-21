import { Response } from './client';
import { PullRequest } from './pull-request';

export interface Repository {
  name: string;
  defaultBranch: string;
  allowMergeCommits: boolean;
  allowSquashCommits: boolean;
  allowRebaseCommits: boolean;
  parent: Repository | undefined;

  listPullRequests(parameters?: ListPullRequestsParameters): Promise<Response<PullRequest[]>>;

  getPullRequest(id: number): Promise<Response<PullRequest>>;

  createPullRequest(body: CreatePullRequestBody): Promise<Response<PullRequest>>;
}

export interface ListPullRequestsParameters {
  state?: 'open' | 'close' | 'all';
  sort?: 'created' | 'updated';
  direction?: 'asc' | 'desc';
}

export interface CreatePullRequestBody {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  body?: string;
}

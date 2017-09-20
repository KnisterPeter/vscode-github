import { PullRequest } from './pull-request';
import { Repository } from './repository';

export interface Client {

  getRepository(rid: string): Promise<Response<Repository>>;

  listPullRequests(rid: string, parameters?: ListPullRequestsParameters): Promise<Response<PullRequest[]>>;

  getPullRequest(rid: string, id: number): Promise<Response<PullRequest>>;

  createPullRequest(rid: string, body: CreatePullRequestBody): Promise<Response<PullRequest>>;

  mergePullRequest(rid: string, number: number, body: MergeBody): Promise<Response<MergeResult>>;

}

export interface Response<T> {
  body: T;
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

export interface MergeBody {
  mergeMethod: MergeMethod;
}

export type MergeMethod = 'merge' | 'squash' | 'rebase';

export interface MergeResult {
  sha?: string;
  merged?: boolean;
  message: string;
}

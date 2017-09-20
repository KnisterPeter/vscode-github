import { PullRequest } from './pull-request';
import { Repository } from './repository';

export interface Client {

  getRepository(rid: string): Promise<Response<Repository>>;

  listPullRequests(rid: string, parameters?: ListPullRequestsParameters): Promise<Response<PullRequest[]>>;

  getPullRequest(rid: string, id: number): Promise<Response<PullRequest>>;

  createPullRequest(rid: string, body: CreatePullRequestBody): Promise<Response<PullRequest>>;

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

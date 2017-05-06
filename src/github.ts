import * as LRUCache from 'lru-cache';
import {Pretend, Get, Post, Put, Delete, Headers, Interceptor, IPretendRequestInterceptor,
  IPretendDecoder} from 'pretend';

export interface GitHub {

  getRepository(owner: string, repo: string): Promise<GitHubResponse<Repository>>;

  getPullRequest(owner: string, repo: string, number: number): Promise<GitHubResponse<PullRequest>>;

  listPullRequests(owner: string, repo: string, parameters?: ListPullRequestsParameters):
    Promise<GitHubResponse<PullRequest[]>>;

  createPullRequest(owner: string, repo: string, body: CreatePullRequestBody): Promise<GitHubResponse<PullRequest>>;

  getStatusForRef(owner: string, repo: string, ref: string): Promise<GitHubResponse<CombinedStatus>>;

  mergePullRequest(owner: string, repo: string, number: number, body: Merge): Promise<GitHubResponse<MergeResult>>;

  addAssignees(owner: string, repo: string, numer: number, body: Assignees): Promise<void>;

  removeAssignees(owner: string, repo: string, numer: number, body: Assignees): Promise<void>;

  requestReview(owner: string, repo: string, numer: number, body: Reviewers): Promise<void>;

  deleteReviewRequest(owner: string, repo: string, numer: number, body: Reviewers): Promise<void>;

  issues(owner: string, repo: string, parameters?: IssuesParameters): Promise<GitHubResponse<Issue[]>>;

}

export interface GitHubResponse<T> {
  status: number;
  headers: {[name: string]: string[]};
  body: T;
}

export interface Issue {
  html_url: string;
  number: number;
  state: 'open';
  title: string;
  pull_request?: object;
}

export interface IssuesParameters {
  milestone?: string|number;
  state?: 'closed' | 'all' | 'open';
  assignee?: string;
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
}

export interface Assignees {
  assignees: string[];
}

export interface Reviewers {
  reviewers: string[];
}

export interface Repository {
  full_name: string;
  default_branch: string;
  allow_rebase_merge: boolean;
  allow_squash_merge: boolean;
  allow_merge_commit: boolean;
  parent?: {
    full_name: string;
    default_branch: string;
  };
}

export type MergeMethod = 'merge' | 'squash' | 'rebase';

export interface Merge {
  commit_title?: string;
  commit_message?: string;
  sha?: string;
  merge_method?: MergeMethod;
}

export interface MergeResult {
  sha?: string;
  merged?: boolean;
  message: string;
  documentation_url?: string;
}

export type PullRequestStatus = 'failure' | 'pending' | 'success';

export interface CombinedStatus {
  state: PullRequestStatus;
  total_count: number;
  statuses: any[];
}

export interface ListPullRequestsParameters {
  state?: 'open' | 'close' | 'all';
  head?: string;
  base?: string;
  sort?: 'created' | 'updated' | 'popularity' | 'long-running';
  direction?: 'asc' | 'desc';
}

export interface CreatePullRequestBody {
  title: string;
  head: string;
  base: string;
  body?: string;
}

export interface PullRequest {
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string;
  html_url: string;
  head: {
    label: string;
    ref: string;
  };
  base: {
    label: string;
    ref: string;
  };
  mergeable?: boolean|null;
}

export function getClient(endpoint: string, token: string): GitHub {
  return Pretend
    .builder()
    .interceptor(impl.githubCache())
    .requestInterceptor(impl.githubTokenAuthenticator(token))
    .interceptor(impl.logger())
    .decode(impl.githubDecoder())
    .target(impl.GitHubBlueprint, endpoint);
}

export class GitHubError extends Error {

  public readonly response: Response;

  constructor(message: string, response: Response) {
    super(message);
    this.response = response;
  }
}

namespace impl {

  export function logger(): Interceptor {
    return async(chain, request) => {
      // console.log('github-request: ', request);
      const response = await chain(request);
      // console.log('response', response);
      return response;
    };
  }

  export function githubCache(): Interceptor {
    // cache at most 100 requests
    const cache = LRUCache<{etag: string, response: any}>(100);
    return async(chain, request) => {
      const entry = cache.get(request.url);
      if (entry) {
        // when we have a cache hit, send etag
        request.options.headers.set('If-None-Match', entry.etag);
      }
      const response = await chain(request);
      if (!entry || response.status !== 304) {
        // if no cache hit or response modified, cache and respond
        cache.set(request.url, {
          etag: response.headers.etag,
          response
        });
        return response;
      }
      // respond from cache
      return entry.response;
    };
  }

  export function githubTokenAuthenticator(token: string): IPretendRequestInterceptor {
    return request => {
      request.options.headers.set('Authorization', `token ${token}`);
      return request;
    };
  }

  export function githubDecoder(): IPretendDecoder {
    return async response => {
      if (response.status >= 400) {
        throw new GitHubError(`${response.statusText}`, response);
      }
      const headers = {};
      response.headers.forEach((value, index) => {
        headers[index] = [...(headers[index] || []), value];
      });
      return {
        status: response.status,
        headers,
        body: response.status === 200 ? await response.json() : undefined
      };
    };
  }

  export class GitHubBlueprint implements GitHub {

    @Headers('Accept: application/vnd.github.polaris-preview')
    @Get('/repos/:owner/:repo')
    public getRepository(_owner: string, _repo: string): any {/* */}

    @Get('/repos/:owner/:repo/pulls/:number')
    public getPullRequest(): any {/* */}

    @Get('/repos/:owner/:repo/pulls', true)
    public listPullRequests(): any {/* */}

    @Post('/repos/:owner/:repo/pulls')
    public createPullRequest(): any {/* */}

    @Get('/repos/:owner/:repo/commits/:ref/status')
    public getStatusForRef(): any {/* */}

    @Headers('Accept: application/vnd.github.polaris-preview+json')
    @Put('/repos/:owner/:repo/pulls/:number/merge')
    public mergePullRequest(): any {/* */}

    @Post('/repos/:owner/:repo/issues/:number/assignees')
    public addAssignees(): any {/* */}

    @Delete('/repos/:owner/:repo/issues/:number/assignees', true)
    public removeAssignees(): any {/* */}

    @Headers('Accept: application/vnd.github.black-cat-preview+json')
    @Post('/repos/:owner/:repo/pulls/:number/requested_reviewers')
    public requestReview(): any {/* */}

    @Headers('Accept: application/vnd.github.black-cat-preview+json')
    @Delete('/repos/:owner/:repo/pulls/:number/requested_reviewers', true)
    public deleteReviewRequest(): any {/* */}

    @Get('/repos/:owner/:repo/issues', true)
    public issues(): any {/* */}

  }
}

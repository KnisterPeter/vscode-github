import {Pretend, Get, Post, Interceptor, IPretendRequestInterceptor,
  IPretendDecoder} from 'pretend';
import * as LRUCache from 'lru-cache';

export interface GitHub {
  listPullRequests(owner: string, repo: string, parameters?: ListPullRequestsParameters):
    Promise<PullRequest[]>;
  createPullRequest(owner: string, repo: string, body: any): Promise<PullRequest>;
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

interface PullRequest {
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
}

export function getClient(token: string): GitHub {
  return Pretend
    .builder()
    .interceptor(impl.githubCache())
    .requestInterceptor(impl.githubTokenAuthenticator(token))
    .decode(impl.githubDecoder())
    .target(impl.GitHubBlueprint, 'https://api.github.com');
}

export class GitHubError extends Error {

  public readonly response: Response;

  constructor(message: string, response: Response) {
    super(message);
    this.response = response;
  }
}

namespace impl {

  export function githubCache(): Interceptor {
    // Cache at most 100 requests
    const cache = LRUCache<{etag: string, response: any}>(100);
    return async (chain, request) => {
      const entry = cache.get(request.url);
      if (entry) {
        // When we have a cache hit, send etag
        if (!request.options.headers) {
          request.options.headers = {};
        }
        request.options.headers['If-None-Match'] = entry.etag;
      }
      const response = await chain(request);
      if (!entry || response.status !== 304) {
        // If no cache hit or response modified, cache and respond
        cache.set(request.url, {
          etag: response.headers.etag,
          response
        });
        return response.body;
      }
      // Respond from cache
      return entry.response.body;
    };
  }

  export function githubTokenAuthenticator(token: string): IPretendRequestInterceptor {
    return request => {
      if (!request.options.headers) {
        request.options.headers = {};
      }
      request.options.headers['Authorization'] = `token ${token}`;
      return request;
    };
  }

  export function githubDecoder(): IPretendDecoder {
    return async response => {
      if (response.status >= 400) {
        throw new GitHubError(`${response.statusText}`, response);
      }
      let headers = {};
      response.headers.forEach((value, index) => {
        headers[index] = value;
      });
      return {
        status: response.status,
        headers,
        body: response.status === 200 ? await response.json() : undefined
      };
    };
  }

  export class GitHubBlueprint implements GitHub {

    @Get('/repos/{owner}/{repo}/pulls', true)
    public listPullRequests(_owner: string, _repo: string, _parameters?: ListPullRequestsParameters): any {
      //
    }

    @Post('/repos/{owner}/{repo}/pulls')
    public createPullRequest(_owner: string, _repo: string, _body: any): any {
      //
    }

  }
}

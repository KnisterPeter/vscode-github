import {Pretend, Get, Post, IPretendRequestInterceptor, IPretendDecoder} from 'pretend';

export function getClient(token: string): GitHub {
  return Pretend
    .builder()
    .requestInterceptor(githubTokenAuthenticator(token))
    .decode(githubDecoder())
    .target(GitHub, 'https://api.github.com');
}

function githubTokenAuthenticator(token: string): IPretendRequestInterceptor {
  return request => {
    if (!request.options.headers) {
      request.options.headers = {};
    }
    request.options.headers['Authorization'] = `token ${token}`;
    return request;
  };
}

export class GitHubError extends Error {

  public readonly response: Response;

  constructor(message: string, response: Response) {
    super(message);
    this.response = response;
  }
}

function githubDecoder(): IPretendDecoder {
  return async response => {
    if (response.status >= 400) {
      throw new GitHubError(`${response.statusText}`, response);
    }
    return {
      headers: response.headers,
      body: await response.json()
    };
  };
}

export class GitHub {

  @Get('/repos/{owner}/{repo}/pulls', true)
  public async listPullRequests(_owner: string, _repo: string, _parameters?: ListPullRequestsParameters):
    Promise<GitHubResonse<PullRequest[]>> { return undefined as any; }

  @Post('/repos/{owner}/{repo}/pulls')
  public async createPullRequest(_owner: string, _repo: string, _body: any):
    Promise<PullRequest> { return undefined as any; }

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

interface GitHubResonse<T> {
  headers: any;
  body: T;
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

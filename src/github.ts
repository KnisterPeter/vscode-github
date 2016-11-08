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

function githubDecoder(): IPretendDecoder {
  return async response => {
    if (response.status >= 400) {
      const err = new Error('GitHub request failed');
      (err as any).response = response;
      throw err;
    }
    return {
      headers: response.headers,
      body: await response.json()
    };
  };
}

export class GitHub {

  @Get('/repos/{owner}/{repo}/pulls')
  public async listPullRequests(_owner: string, _repo: string):
    Promise<GitHubResonse<PullRequest[]>> { return undefined as any; }

  @Post('/repos/{owner}/{repo}/pulls')
  public async createPullRequest(_owner: string, _repo: string, _body: any):
    Promise<void> { return undefined as any; }

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
  head: {
    label: string;
    ref: string;
  };
  base: {
    label: string;
    ref: string;
  };
}

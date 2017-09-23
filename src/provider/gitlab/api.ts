import {
  Pretend,
  Interceptor,
  IPretendRequestInterceptor,
  IPretendDecoder,
  Get
} from 'pretend';

export interface GitLab {
  getProject(id: string): Promise<GitLabResponse<Project>>;
}

export interface GitLabResponse<T> {
  status: number;
  headers: {[name: string]: string[]};
  body: T;
}

export interface Project {
  id: number;
  name: string;
  default_branch: string;
  web_url: string;
  merge_requests_enabled: boolean;
}

export function getClient(endpoint: string, token: string): GitLab {
  return Pretend
    .builder()
    .requestInterceptor(impl.gitlabTokenAuthenticator(token))
    .interceptor(impl.logger())
    .decode(impl.gitlabDecoder())
    .target(impl.GitLabBlueprint, endpoint);
}

export class GitLabError extends Error {

    public readonly response: Response;

    constructor(message: string, response: Response) {
      super(message);
      this.response = response;
    }
  }

namespace impl {

  export function logger(): Interceptor {
    return async(chain, request) => {
      // console.log('gitlab-request: ', request);
      const response = await chain(request);
      // console.log('response', response);
      return response;
    };
  }

  export function gitlabTokenAuthenticator(token: string): IPretendRequestInterceptor {
    return request => {
      request.options.headers.set('PRIVATE-TOKEN', `${token}`);
      return request;
    };
  }

  export function gitlabDecoder(): IPretendDecoder {
    return async response => {
      if (response.status >= 400) {
        const body = await response.json();
        throw new GitLabError(`${body.message || response.statusText}`, response);
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

  export class GitLabBlueprint implements GitLab {
    @Get('/projects/:id')
    public getProject(): any {/* */}
  }

}

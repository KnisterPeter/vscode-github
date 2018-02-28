import * as https from 'https';
import {
  Pretend,
  Interceptor,
  IPretendRequestInterceptor,
  IPretendDecoder,
  Get,
  Post,
  Put
} from 'pretend';

export interface GitLab {
  getProjects(): Promise<GitLabResponse<Project>>;

  getProject(id: string): Promise<GitLabResponse<Project>>;

  getMergeRequests(id: string, parameters?: GetMergeRequestParameters): Promise<GitLabResponse<MergeRequest[]>>;

  getMergeRequest(id: string, mr_iid: number): Promise<GitLabResponse<MergeRequest>>;

  createMergeRequest(id: string, body: CreateMergeRequestBody): Promise<GitLabResponse<MergeRequest>>;

  updateMergeRequest(id: string, mr_iid: number, body: UpdateMergeRequestBody): Promise<GitLabResponse<MergeRequest>>;

  acceptMergeRequest(id: string, mr_iid: number, body: AcceptMergeRequestBody)
    : Promise<GitLabResponse<AcceptMergeRequestResponse>>;

  getProjectIssues(id: string, body: ProjectIssuesBody): Promise<GitLabResponse<Issue[]>>;

  getAuthenticatedUser(): Promise<GitLabResponse<UserResponse>>;

  searchUser(parameters?: SearchUsersParameters): Promise<GitLabResponse<UserResponse[]>>;

  getIssueNotes(id: string, issue_iid: number): Promise<GitLabResponse<IssueNote[]>>;
}

export interface GitLabResponse<T> {
  status: number;
  headers: {[name: string]: string[]};
  body: T;
}

export interface IssueNote {
  body: string;
  author: UserResponse;
}

export interface AcceptMergeRequestBody {
  should_remove_source_branch?: boolean;
}

export interface AcceptMergeRequestResponse {
  title: string;
  state: 'merged';
  sha: string;
}

export interface SearchUsersParameters {
  username?: string;
}

export interface UserResponse {
  id: number;
  username: string;
}

export interface ProjectIssuesBody {
  state?: 'opened' | 'closed';
  order_by?: 'created_at' | 'updated_at';
  sort?: 'asc' | 'desc';
}

export interface Issue {
  iid: number;
  title: string;
  web_url: string;
  description: string;
}

export interface CreateMergeRequestBody {
  source_branch: string;
  target_branch: string;
  title: string;
  description?: string;
  remove_source_branch?: boolean;
}

export interface UpdateMergeRequestBody {
  target_branch?: string;
  title?: string;
  description?: string;
  state_event?: 'close' | 'reopen';
  assignee_id?: number;
  remove_source_branch?: boolean;
  squash?: boolean;
}

export interface GetMergeRequestParameters {
  state?: 'opened' | 'closed' | 'merged';
  order_by?: 'created_at' | 'updated_at';
  sort?: 'asc' | 'desc';
}

export interface MergeRequest {
  id: number;
  iid: number;
  state: 'opened' | 'closed' | 'merged';
  title: string;
  description: string;
  web_url: string;
  target_branch: string;
  source_branch: string;
  merge_status: 'can_be_merged';
}

export interface Project {
  id: number;
  path_with_namespace: string;
  name: string;
  default_branch: string;
  web_url: string;
  merge_requests_enabled: boolean;
}

export function getClient(endpoint: string, token: string, logger: (message: string) => void,
                          allowUnsafeSSL = false): GitLab {
  return Pretend
    .builder()
    .requestInterceptor(impl.gitlabTokenAuthenticator(token))
    .requestInterceptor(impl.gitlabHttpsAgent(!allowUnsafeSSL))
    .requestInterceptor(impl.formEncoding())
    .interceptor(impl.logger(logger))
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

  export function logger(logger: (message: string) => void): Interceptor {
    return async(chain, request) => {
      try {
        logger(`${request.options.method} ${request.url}`);
        // console.log('gitlab-request: ', request);
        const response = await chain(request);
        // console.log('response', response);
        return response;
      } catch (e) {
        logger(`${(e as GitLabError).response.status} ${e.message}`);
        throw e;
      }
    };
  }

  export function gitlabTokenAuthenticator(token: string): IPretendRequestInterceptor {
    return request => {
      request.options.headers = new Headers(request.options.headers);
      request.options.headers.set('PRIVATE-TOKEN', `${token}`);
      return request;
    };
  }

  export function gitlabHttpsAgent(rejectUnauthorized: boolean): IPretendRequestInterceptor {
    return request => {
      if (!request.url.startsWith('https://')) {
        return request;
      }
      request.options.agent = new https.Agent({ rejectUnauthorized });
      return request;
    };
  }

  export function formEncoding(): IPretendRequestInterceptor {
    return request => {
      if (request.options.method !== 'GET') {
        request.options.headers = new Headers(request.options.headers);
        request.options.headers.set('Content-Type', 'application/x-www-form-urlencoded');
        if (request.options.body) {
          const body = JSON.parse(request.options.body.toString());
          const encodedBody = Object.keys(body)
            .reduce((query, name) => {
              return `${query}&${name}=${encodeURIComponent(body[name])}`;
            }, '')
            .replace(/^&/, '');
          request.options.body = encodedBody;
        }
      }
      return request;
    };
  }

  export function gitlabDecoder(): IPretendDecoder {
    return async response => {
      if (response.status >= 400) {
        const body = await response.json();
        throw new GitLabError(`${body.error || response.statusText}`, response);
      }
      const headers = {};
      response.headers.forEach((value, index) => {
        headers[index] = [...(headers[index] || []), value];
      });
      return {
        status: response.status,
        headers,
        body: response.status >= 200 && response.status <= 300 ? await response.json() : undefined
      };
    };
  }

  export class GitLabBlueprint implements GitLab {

    @Get('/projects')
    public getProjects(): any {/* */}

    @Get('/user', true)
    public getAuthenticatedUser(): any {/* */}

    @Get('/users', true)
    public searchUser(): any {/* */}

    @Get('/projects/:id')
    public getProject(): any {/* */}

    @Get('/projects/:id/merge_requests', true)
    public getMergeRequests(): any {/* */}

    @Get('/projects/:id/merge_requests/:merge_request_iid')
    public getMergeRequest(): any {/* */}

    @Post('/projects/:id/merge_requests')
    public createMergeRequest(): any {/* */}

    @Put('/projects/:id/merge_requests/:merge_request_iid')
    public updateMergeRequest(): any {/* */}

    @Put('/projects/:id/merge_requests/:merge_request_iid/merge')
    public acceptMergeRequest(): any {/* */}

    @Get('/projects/:id/issues')
    public getProjectIssues(): any {/* */}

    @Get('/projects/:id/issues/:issue_iid/notes')
    public getIssueNotes(): any {/* */}

  }

}

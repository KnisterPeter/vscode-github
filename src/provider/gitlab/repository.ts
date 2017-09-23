import { Response } from '../client';
import { Issue } from '../issue';
import {
  Repository,
  ListPullRequestsParameters,
  CreatePullRequestBody,
  IssuesParameters
} from '../repository';
import { GitLab, Project, GetMergeRequestParameters } from './api';
import { GitLabMergeRequest } from './merge-request';

export class GitLabRepository implements Repository {

  private client: GitLab;
  private project: Project;

  public get name(): string {
    return this.project.name;
  }

  public get pathWithNamespace(): string {
    return this.project.path_with_namespace;
  }

  public get defaultBranch(): string {
    return this.project.default_branch;
  }

  public get allowMergeCommits(): boolean {
    return this.project.merge_requests_enabled;
  }

  public get allowSquashCommits(): boolean {
    return false;
  }

  public get allowRebaseCommits(): boolean {
    return false;
  }

  public get parent(): Repository | undefined {
    return undefined;
  }

  public get url(): string {
    return this.project.web_url;
  }

  constructor(client: GitLab, project: Project) {
    this.client = client;
    this.project = project;
  }

  public async getPullRequests(parameters: ListPullRequestsParameters = {}):
      Promise<Response<GitLabMergeRequest[]>> {
    function getState(state: ListPullRequestsParameters['state']): GetMergeRequestParameters['state'] {
      switch (state) {
        case 'open':
          return 'opened';
        case 'close':
          return 'closed';
        default:
          return undefined;
      }
    }
    function getOrderBy(orderBy: ListPullRequestsParameters['sort']): GetMergeRequestParameters['order_by'] {
      switch (orderBy) {
        case 'created':
          return 'created_at';
        case 'updated':
          return 'updated_at';
        default:
          return undefined;
      }
    }

    const params: GetMergeRequestParameters = {};
    if (parameters.state) {
      params.state = getState(parameters.state);
    }
    if (parameters.sort) {
      params.order_by = getOrderBy(parameters.sort);
    }
    if (parameters.direction) {
      params.sort = parameters.direction;
    }
    const respose = await this.client.getMergeRequests(encodeURIComponent(this.project.path_with_namespace), params);
    return {
      body: respose.body.map(mergeRequest => new GitLabMergeRequest(this.client, this, mergeRequest))
    };
  }

  public async getPullRequest(id: number): Promise<Response<GitLabMergeRequest>> {
    const response = await this.client.getMergeRequest(
      encodeURIComponent(this.project.path_with_namespace),
      id
    );
    return {
      body: new GitLabMergeRequest(this.client, this, response.body)
    };
  }

  public async createPullRequest(_body: CreatePullRequestBody): Promise<Response<GitLabMergeRequest>> {
    throw new Error('Method not implemented.');
  }

  public async getIssues(_parameters?: IssuesParameters | undefined): Promise<Response<Issue[]>> {
    throw new Error('Method not implemented.');
  }
}

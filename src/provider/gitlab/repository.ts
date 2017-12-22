import * as vscode from 'vscode';
import { getConfiguration } from '../../helper';
import { Response } from '../client';
import { Issue } from '../issue';
import {
  Repository,
  ListPullRequestsParameters,
  CreatePullRequestBody,
  IssuesParameters
} from '../repository';
import {
  GitLab,
  Project,
  GetMergeRequestParameters,
  CreateMergeRequestBody,
  ProjectIssuesBody
} from './api';
import { GitLabIssue } from './issue';
import { GitLabMergeRequest } from './merge-request';
import { GitLabUser } from './user';

export class GitLabRepository implements Repository {

  public readonly uri: vscode.Uri | undefined;

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

  constructor(uri: vscode.Uri | undefined, client: GitLab, project: Project) {
    this.uri = uri;
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

  public async createPullRequest(body: CreatePullRequestBody): Promise<Response<GitLabMergeRequest>> {
    const removeSourceBranch = this.uri
      ? getConfiguration('gitlab', this.uri).removeSourceBranch
      : false;
    const gitlabBody: CreateMergeRequestBody =  {
      source_branch: body.sourceBranch,
      target_branch: body.targetBranch,
      title: body.title,
      remove_source_branch: removeSourceBranch
    };
    if (body.body) {
     gitlabBody.description = body.body;
    }
    const response = await this.client.createMergeRequest(
      encodeURIComponent(this.project.path_with_namespace),
      gitlabBody
    );
    return {
      body: new GitLabMergeRequest(this.client, this, response.body)
    };
  }

  public async getIssues(parameters?: IssuesParameters | undefined): Promise<Response<Issue[]>> {
    function getState(state: IssuesParameters['state']): ProjectIssuesBody['state'] {
      switch (state) {
        case 'open':
          return 'opened';
        case 'closed':
          return 'closed';
      }
      return undefined;
    }
    function getOrderBy(orderBy: IssuesParameters['sort']): ProjectIssuesBody['order_by'] {
      switch (orderBy) {
        case 'created':
          return 'created_at';
        case 'updated':
          return 'updated_at';
        default:
          return undefined;
      }
    }

    const body: ProjectIssuesBody = {};
    if (parameters) {
      if (parameters.state && parameters.state !== 'all') {
        body.state = getState(parameters.state);
      }
      if (parameters.sort) {
        body.order_by = getOrderBy(parameters.sort);
      }
      if (parameters.direction) {
        body.sort = parameters.direction;
      }
    }
    const response = await this.client.getProjectIssues(
      encodeURIComponent(this.project.path_with_namespace),
      body
    );
    return {
      body: response.body.map(issue => new GitLabIssue(this.client, this, issue))
    };
  }

  public async getUsers(): Promise<Response<GitLabUser[]>> {
    const response = await this.client.searchUser();
    return {
      body: response.body.map(user => new GitLabUser(this.client, user))
    };
  }
}

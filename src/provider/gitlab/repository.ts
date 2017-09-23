import { Response } from '../client';
import { Issue } from '../issue';
import {
  Repository,
  ListPullRequestsParameters,
  CreatePullRequestBody,
  IssuesParameters
} from '../repository';
import { GitLab, Project } from './api';
import { GitLabMergeRequest } from './merge-request';

export class GitLabRepository implements Repository {

  private client: GitLab;
  private project: Project;

  public get name(): string {
    return this.project.name;
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

  constructor(client: GitLab, project: Project) {
    this.client = client;
    this.project = project;
  }

  public async getPullRequests(_parameters?: ListPullRequestsParameters | undefined):
      Promise<Response<GitLabMergeRequest[]>> {
    throw new Error('Method not implemented.');
  }

  public async getPullRequest(_id: number): Promise<Response<GitLabMergeRequest>> {
    throw new Error('Method not implemented.');
  }

  public async createPullRequest(_body: CreatePullRequestBody): Promise<Response<GitLabMergeRequest>> {
    throw new Error('Method not implemented.');
  }

  public async getIssues(_parameters?: IssuesParameters | undefined): Promise<Response<Issue[]>> {
    throw new Error('Method not implemented.');
  }
}

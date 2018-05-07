import * as vscode from 'vscode';
import { Response } from '../client';
import { Issue } from '../issue';
import {
  Repository,
  ListPullRequestsParameters,
  CreatePullRequestBody,
  IssuesParameters
} from '../repository';
import { GitHub, GithubRepositoryStruct } from './api';
import { GithubIssue } from './issue';
import { GithubPullRequest } from './pull-request';
import { GithubUser } from './user';

export class GithubRepository implements Repository {

  public readonly uri: vscode.Uri | undefined;

  private readonly client: GitHub;

  private readonly struct: GithubRepositoryStruct;

  public owner: string;
  public repository: string;

  public get slug(): string {
    return `${this.owner}/${this.repository}`;
  }

  public get name(): string {
    return this.struct.full_name;
  }

  public get defaultBranch(): string {
    return this.struct.default_branch;
  }

  public get allowMergeCommits(): boolean {
    return Boolean(this.struct.allow_merge_commit);
  }

  public get allowSquashCommits(): boolean {
    return Boolean(this.struct.allow_squash_merge);
  }

  public get allowRebaseCommits(): boolean {
    return Boolean(this.struct.allow_rebase_merge);
  }

  public get parent(): Repository | undefined {
    if (!this.struct.parent) {
      return undefined;
    }
    return new GithubRepository(
      undefined,
      this.client,
      this.struct.parent.owner.login,
      this.struct.parent.name,
      this.struct.parent
    );
  }

  public get url(): string {
    return this.struct.html_url;
  }

  constructor(
      uri: vscode.Uri | undefined,
      client: GitHub,
      owner: string,
      repository: string,
      struct: GithubRepositoryStruct
    ) {
    this.uri = uri;
    this.client = client;
    this.owner = owner;
    this.repository = repository;
    this.struct = struct;
  }

  public async getPullRequests(parameters?: ListPullRequestsParameters | undefined):
      Promise<Response<GithubPullRequest[]>> {
    const response = await this.client.listPullRequests(this.owner, this.repository, parameters);
    const body = response.body.map(pr => new GithubPullRequest(this.client, this, pr));
    return {
      body
    };
  }

  public async getPullRequest(id: number): Promise<Response<GithubPullRequest>> {
    const response = await this.client.getPullRequest(this.owner, this.repository, id);
    return {
      body: new GithubPullRequest(this.client, this, response.body)
    };
  }

  public async createPullRequest(body: CreatePullRequestBody): Promise<Response<GithubPullRequest>> {
    const result = await this.client.createPullRequest(this.owner, this.repository, {
      head: `${this.owner}:${body.sourceBranch}`,
      base: `${body.targetBranch}`,
      title: body.title,
      body: body.body
    });
    const expr = new RegExp(`https?://[^/:]+/repos/[^/]+/[^/]+/pulls/([0-9]+)`);
    const number = expr.exec(result.headers['location'][0]) as RegExpMatchArray;
    const response = await this.client.getPullRequest(this.owner, this.repository, parseInt(number[1], 10));
    return {
      body: new GithubPullRequest(this.client, this, response.body)
    };
  }

  public async getIssues(parameters: IssuesParameters = {}): Promise<Response<Issue[]>> {
    const response = await this.client.issues(this.owner, this.repository, {
      direction: parameters.direction,
      sort: parameters.sort,
      state: parameters.state || 'all'
    });
    return {
      body: response.body
        .filter(issue => !Boolean(issue.pull_request))
        .map(issue => new GithubIssue(this.client, this, issue))
    };
  }

  public async getUsers(): Promise<Response<GithubUser[]>> {
    const response = await this.client.listAssignees(
      this.owner,
      this.repository
    );
    return {
      body: response.body.map(user => new GithubUser(this.client, user))
    };
  }
}

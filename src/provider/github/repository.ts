import { Response } from '../client';
import { Issue } from '../issue';
import {
  Repository,
  ListPullRequestsParameters,
  CreatePullRequestBody,
  IssuesParameters
} from '../repository';
import { GitHub, GithubRepositoryStruct } from './index';
import { GithubPullRequest } from './pull-request';

export class GithubRepository implements Repository {

  private client: GitHub;

  private struct: GithubRepositoryStruct;

  public owner: string;
  public repository: string;

  get slug(): string {
    return `${this.owner}/${this.repository}`;
  }

  get name(): string {
    return this.struct.full_name;
  }

  get defaultBranch(): string {
    return this.struct.default_branch;
  }

  get allowMergeCommits(): boolean {
    return Boolean(this.struct.allow_merge_commit);
  }

  get allowSquashCommits(): boolean {
    return Boolean(this.struct.allow_squash_merge);
  }

  get allowRebaseCommits(): boolean {
    return Boolean(this.struct.allow_rebase_merge);
  }

  get parent(): Repository | undefined {
    if (!this.struct.parent) {
      return undefined;
    }
    // fixme: owner and repository should be set here
    return new GithubRepository(this.client, '', '', this.struct.parent);
  }

  constructor(client: GitHub, owner: string, repository: string, struct: GithubRepositoryStruct) {
    this.client = client;
    this.owner = owner;
    this.repository = repository;
    this.struct = struct;
  }

  public async listPullRequests(parameters?: ListPullRequestsParameters | undefined):
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
        .map(issue => ({
          number: issue.number,
          title: issue.title,
          url: issue.html_url
        }))
    };
  }
}

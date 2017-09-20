import {
  Client,
  Response,
  ListPullRequestsParameters,
  CreatePullRequestBody
} from '../client';

import { GitHub, getClient } from './index';
import { GithubPullRequest } from './pull-request';
import { GithubRepository } from './repository';

export class GithubClient implements Client {

  public client: GitHub;

  constructor(endpoint: string, token: string) {
    this.client = getClient(endpoint, token);
  }

  private getOwnerAndRepository(id: string): [string, string] {
    return id.split('/') as [string, string];
  }

  public async getRepository(id: string): Promise<Response<GithubRepository>> {
    const [owner, repository] = this.getOwnerAndRepository(id);
    const response = await this.client.getRepository(owner, repository);
    return {
      body: new GithubRepository(response.body)
    };
  }

  public async listPullRequests(id: string, parameters?: ListPullRequestsParameters):
      Promise<Response<GithubPullRequest[]>> {
    const [owner, repository] = this.getOwnerAndRepository(id);
    const response = await this.client.listPullRequests(owner, repository, parameters);
    const body = response.body.map(pr => new GithubPullRequest(pr));
    return {
      body
    };
  }

  public async getPullRequest(rid: string, id: number): Promise<Response<GithubPullRequest>> {
    const [owner, repository] = this.getOwnerAndRepository(rid);
    const response = await this.client.getPullRequest(owner, repository, id);
    return {
      body: new GithubPullRequest(response.body)
    };
  }

  public async createPullRequest(id: string, body: CreatePullRequestBody): Promise<Response<GithubPullRequest>> {
    const [owner, repository] = this.getOwnerAndRepository(id);
    const result = await this.client.createPullRequest(owner, repository, {
      head: `${owner}:${body.sourceBranch}`,
      base: `${body.targetBranch}`,
      title: body.title,
      body: body.body
    });
    const expr = new RegExp(`https?://[^/:]+/repos/[^/]+/[^/]+/pulls/([0-9]+)`);
    const number = expr.exec(result.headers['location'][0]) as RegExpMatchArray;
    const response = await this.client.getPullRequest(owner, repository, parseInt(number[1], 10));
    return {
      body: new GithubPullRequest(response.body)
    };
  }
}

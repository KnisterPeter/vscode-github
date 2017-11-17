import * as vscode from 'vscode';
import { Client, Response } from '../client';
import { getClient, GitLab } from './api';
import { GitLabRepository } from './repository';
import { GitLabUser } from './user';

export class GitLabClient implements Client {

  private client: GitLab;

  public name = 'GitLab Client';

  constructor(protocol: string, hostname: string, token: string, logger: (message: string) => void) {
    this.client = getClient(this.getApiEndpoint(protocol, hostname), token, logger);
  }

  private getApiEndpoint(protocol: string, hostname: string): string {
    return `${protocol}//${hostname}/api/v4`;
  }

  public async test(): Promise<void> {
    await this.client.getProjects();
  }

  public async createRepository(user: GitLabUser, name: string): Promise<Response<GitLabRepository>> {
    const response = await this.client.createProject(user.id, {name});
    return {
      body: new GitLabRepository(undefined, this.client, response.body)
    };
  }

  public async getRepository(uri: vscode.Uri, rid: string): Promise<Response<GitLabRepository>> {
    const response = (await this.client.getProject(encodeURIComponent(rid))).body;
    return {
      body: new GitLabRepository(uri, this.client, response)
    };
  }

  public async getUserByUsername(username: string): Promise<Response<GitLabUser>> {
    const response = await this.client.searchUser({
      username
    });
    return {
      body: new GitLabUser(this.client, response.body[0])
    };
  }

}

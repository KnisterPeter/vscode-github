import { Client, Response } from '../client';
import { getClient, GitLab } from './api';
import { GitLabRepository } from './repository';

export class GitLabClient implements Client {

  private client: GitLab;

  constructor(protocol: string, hostname: string, token: string) {
    this.client = getClient(this.getApiEndpoint(protocol, hostname), token);
  }

  private getApiEndpoint(protocol: string, hostname: string): string {
    return `${protocol}//${hostname}/api/v4`;
  }

  public async getRepository(rid: string): Promise<Response<GitLabRepository>> {
    const response = (await this.client.getProject(encodeURIComponent(rid))).body;
    return {
      body: new GitLabRepository(this.client, response)
    };
  }

}

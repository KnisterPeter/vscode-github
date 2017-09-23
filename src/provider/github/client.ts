import {
  Client,
  Response
} from '../client';

import { GitHub, getClient } from './index';
import { GithubRepository } from './repository';

export class GithubClient implements Client {

  private client: GitHub;

  constructor(protocol: string, hostname: string, token: string) {
    this.client = getClient(this.getApiEndpoint(protocol, hostname), token);
  }

  private getApiEndpoint(protocol: string, hostname: string): string {
    if (hostname === 'github.com') {
      return 'https://api.github.com';
    }
    if (hostname.startsWith('http')) {
      return `${hostname}/api/v3`;
    }
    return `${protocol}//${hostname}/api/v3`;
  }

  public async getRepository(rid: string): Promise<Response<GithubRepository>> {
    const [owner, repository] = rid.split('/');
    const response = await this.client.getRepository(owner, repository);
    return {
      body: new GithubRepository(this.client, owner, repository, response.body)
    };
  }

}

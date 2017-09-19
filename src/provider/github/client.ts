import { Client, Response } from '../client';
import { Repository } from '../repository';

import { GitHub, getClient } from './index';
import { GithubRepository } from './repository';

export class GithubClient implements Client {

  public client: GitHub;

  constructor(endpoint: string, token: string) {
    this.client = getClient(endpoint, token);
  }

  private getOwnerAndRepository(id: string): [string, string] {
    return id.split('/') as [string, string];
  }

  public async getRepository(id: string): Promise<Response<Repository>> {
    const [owner, repository] = this.getOwnerAndRepository(id);
    const response = await this.client.getRepository(owner, repository);
    return {
      body: new GithubRepository(response.body)
    };
  }

}

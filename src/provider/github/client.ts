import {
  Client,
  Response
} from '../client';

import { GitHub, getClient } from './index';
import { GithubRepository } from './repository';

export class GithubClient implements Client {

  private client: GitHub;

  constructor(endpoint: string, token: string) {
    this.client = getClient(endpoint, token);
  }

  public async getRepository(rid: string): Promise<Response<GithubRepository>> {
    const [owner, repository] = rid.split('/');
    const response = await this.client.getRepository(owner, repository);
    return {
      body: new GithubRepository(this.client, owner, repository, response.body)
    };
  }

}

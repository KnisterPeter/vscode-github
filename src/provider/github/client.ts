import * as vscode from 'vscode';
import {
  Client,
  Response
} from '../client';

import { GitHub, getClient } from './api';
import { GithubRepository } from './repository';
import { GithubUser } from './user';

export class GithubClient implements Client {

  private client: GitHub;

  public name = 'GitHub Client';

  constructor(protocol: string, hostname: string, token: string, logger: (message: string) => void) {
    this.client = getClient(this.getApiEndpoint(protocol, hostname), token, logger);
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

  public async test(): Promise<void> {
    await this.client.getRepositories();
  }

  public async getRepository(uri: vscode.Uri, rid: string): Promise<Response<GithubRepository>> {
    const [owner, repository] = rid.split('/');
    const response = await this.client.getRepository(owner, repository);
    return {
      body: new GithubRepository(uri, this.client, owner, repository, response.body)
    };
  }

  public async getUserByUsername(username: string): Promise<Response<GithubUser>> {
    const response = await this.client.getUser(username);
    return {
      body: new GithubUser(this.client, response.body)
    };
  }
}

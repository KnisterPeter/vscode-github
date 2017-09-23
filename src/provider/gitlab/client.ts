import { Client, Response } from '../client';
import { GitlabRepository } from './repository';

export class GitlabClient implements Client {

  public async getRepository(_rid: string): Promise<Response<GitlabRepository>> {
    throw new Error('Method not implemented.');
  }

}

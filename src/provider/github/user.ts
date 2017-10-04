import { User } from '../user';
import { GitHub, UserResponse } from './index';

export class GithubUser implements User {

  private client: GitHub;

  private struct: UserResponse;

  public get id(): number {
    return this.struct.id;
  }

  public get username(): string {
    return this.struct.login;
  }

  constructor(client: GitHub, struct: UserResponse) {
    this.client = client;
    this.struct = struct;
  }

}

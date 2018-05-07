import { User } from '../user';
import { GitHub, UserResponse } from './api';

export class GithubUser implements User {

  // private client: GitHub;

  private readonly struct: UserResponse;

  public get id(): number {
    return this.struct.id;
  }

  public get username(): string {
    return this.struct.login;
  }

  constructor(_client: GitHub, struct: UserResponse) {
    // this.client = client;
    this.struct = struct;
  }

}

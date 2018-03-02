import { User } from '../user';
import { GitLab, UserResponse } from './api';

export class GitLabUser implements User {

  // private client: GitLab;

  private struct: UserResponse;

  public get id(): number {
    return this.struct.id;
  }

  public get username(): string {
    return this.struct.username;
  }

  constructor(_client: GitLab, struct: UserResponse) {
    // this.client = client;
    this.struct = struct;
  }

}

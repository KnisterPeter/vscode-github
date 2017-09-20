import { PullRequest } from '../pull-request';
import { PullRequestStruct } from './index';

export class GithubPullRequest implements PullRequest {

  public struct: PullRequestStruct;

  get id(): number {
    return this.struct.id;
  }

  get number(): number {
    return this.struct.number;
  }

  get state(): 'open' | 'closed' {
    return this.struct.state;
  }

  get title(): string {
    return this.struct.title;
  }

  get body(): string {
    return this.struct.body;
  }

  get url(): string {
    return this.struct.html_url;
  }

  get sourceBranch(): string {
    return this.struct.head.ref;
  }

  get targetBranch(): string {
    return this.struct.base.ref;
  }

  get mergeable(): boolean | null | undefined {
    return this.struct.mergeable;
  }

  constructor(struct: PullRequestStruct) {
    this.struct = struct;
  }

}

import { Repository } from '../repository';
import { GithubRepositoryStruct } from './index';

export class GithubRepository implements Repository {

  public struct: GithubRepositoryStruct;

  get name(): string {
    return this.struct.full_name;
  }

  get defaultBranch(): string {
    return this.struct.default_branch;
  }

  get allowMergeCommits(): boolean {
    return Boolean(this.struct.allow_merge_commit);
  }

  get allowSquashCommits(): boolean {
    return Boolean(this.struct.allow_squash_merge);
  }

  get allowRebaseCommits(): boolean {
    return Boolean(this.struct.allow_rebase_merge);
  }

  get parent(): Repository | undefined {
    if (!this.struct.parent) {
      return undefined;
    }
    return new GithubRepository(this.struct.parent);
  }

  constructor(struct: GithubRepositoryStruct) {
    this.struct = struct;
  }

}

export interface Repository {
  name: string;
  defaultBranch: string;
  allowMergeCommits: boolean;
  allowSquashCommits: boolean;
  allowRebaseCommits: boolean;
  parent: Repository | undefined;
}

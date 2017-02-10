import * as vscode from 'vscode';

import * as git from './git';
import {getClient, GitHub, GitHubError, PullRequest, PullRequestComment, ListPullRequestsParameters,
  CreatePullRequestBody, PullRequestStatus, Merge, MergeMethod} from './github';

export class GitHubManager {

  private cwd: string;

  private channel: vscode.OutputChannel;

  private github: GitHub;

  constructor(cwd: string, channel: vscode.OutputChannel) {
    this.cwd = cwd;
    this.channel = channel;
  }

  private log(message: string): void {
    this.channel.appendLine(message);
    console.log(message);
  }

  get connected(): boolean {
    return Boolean(this.github);
  }

  public connect(token: string): void {
    this.github = getClient(token);
  }

  public async getDefaultBranch(): Promise<string> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    return (await this.github.getRepository(owner, repository)).body.default_branch;
  }

  public async getEnabledMergeMethods(): Promise<Set<MergeMethod>> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    const repo = await this.github.getRepository(owner, repository);
    const set = new Set();
    if (repo.body.allow_merge_commit) {
      set.add('merge');
    }
    if (repo.body.allow_squash_merge) {
      set.add('squash');
    }
    if (repo.body.allow_rebase_merge) {
      set.add('rebase');
    }
    return set;
  }

  public async getPullRequestForCurrentBranch(): Promise<PullRequest|undefined> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    const branch = await git.getCurrentBranch(this.cwd);
    const parameters: ListPullRequestsParameters = {
      state: 'open',
      head: `${owner}:${branch}`
    };
    const list = await this.github.listPullRequests(owner, repository, parameters);
    if (list.body.length === 0) {
      return undefined;
    }
    return (await this.github.getPullRequest(owner, repository, list.body[0].number)).body;
  }

  public async getPullRequestReviewComments(pullRequest: PullRequest): Promise<PullRequestComment[]> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    return (await this.github.getPullRequestComments(owner, repository, pullRequest.number)).body;
  }

  public async hasPullRequestForCurrentBranch(): Promise<boolean> {
    return Boolean(await this.getPullRequestForCurrentBranch());
  }

  public async getCombinedStatusForPullRequest(): Promise<PullRequestStatus |undefined> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    const branch = await git.getCurrentBranch(this.cwd);
    if (!branch) {
      return undefined;
    }
    const response = await this.github.getStatusForRef(owner, repository, branch);
    return response.body.total_count > 0 ? response.body.state : undefined;
  }

  public async createPullRequest(): Promise<PullRequest|undefined> {
    if (await this.hasPullRequestForCurrentBranch()) {
      return undefined;
    }
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    const branch = await git.getCurrentBranch(this.cwd);
    if (!branch) {
      throw new Error('No current branch');
    }
    this.log(`Create pull request on branch ${branch}`);
    const firstCommit = await git.getFirstCommitOnBranch(branch, this.cwd);
    this.log(`First commit on branch ${firstCommit}`);
    const body: CreatePullRequestBody = {
      title: await git.getCommitMessage(firstCommit, this.cwd),
      head: `${owner}:${branch}`,
      base: await this.getDefaultBranch(),
      body: await git.getPullRequestBody(firstCommit, this.cwd)
    };
    this.channel.appendLine('Create pull request:');
    this.channel.appendLine(JSON.stringify(body, undefined, ' '));

    try {
      const result = await this.github.createPullRequest(owner, repository, body);
      // tslint:disable-next-line:comment-format
      // TODO: Pretend should optionally redirect
      const number = result.headers['location'][0]
        .match(/https:\/\/api.github.com\/repos\/[^\/]+\/[^\/]+\/pulls\/([0-9]+)/) as RegExpMatchArray;
      return (await this.github.getPullRequest(owner, repository, parseInt(number[1] as string, 10))).body;
    } catch (e) {
      if (e instanceof GitHubError) {
        console.log(e);
        this.channel.appendLine('Create pull request error:');
        this.channel.appendLine(JSON.stringify(e.response, undefined, ' '));
      }
      throw e;
    }
  }

  public async listPullRequests(): Promise<PullRequest[]> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    const parameters: ListPullRequestsParameters = {
      state: 'open'
    };
    return (await this.github.listPullRequests(owner, repository, parameters)).body;
  }

  public async mergePullRequest(pullRequest: PullRequest, method: MergeMethod): Promise<boolean|undefined> {
    try {
      if (pullRequest.mergeable) {
        const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
        const body: Merge = {
          merge_method: method
        };
        const result = await this.github.mergePullRequest(owner, repository, pullRequest.number, body);
        return result.body.merged;
      }
      return undefined;
    } catch (e) {
      if (!(e instanceof GitHubError)) {
        throw e;
      }
      this.channel.appendLine('Error while merging:');
      this.channel.appendLine(JSON.stringify(await e.response.json(), undefined, ' '));
      // status 405 (method not allowed)
      // tslint:disable-next-line:comment-format
      // TODO...
      return false;
    }
  }

}

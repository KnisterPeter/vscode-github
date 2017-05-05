import * as vscode from 'vscode';

import * as git from './git';
import {getClient, GitHub, GitHubError, PullRequest, ListPullRequestsParameters, CreatePullRequestBody,
  PullRequestStatus, Merge, MergeMethod, Repository} from './github';

export class GitHubManager {

  private cwd: string;

  private hostname: string;

  private apiEndpoint: string;

  private channel: vscode.OutputChannel;

  private github: GitHub;

  constructor(cwd: string, hostname: string, apiEndpoint: string, channel: vscode.OutputChannel) {
    this.cwd = cwd;
    this.hostname = hostname;
    this.apiEndpoint = apiEndpoint;
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
    this.github = getClient(this.apiEndpoint, token);
  }

  public async getRepository(): Promise<Repository> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd, this.hostname);
    return (await this.github.getRepository(owner, repository)).body;
  }

  public async getDefaultBranch(): Promise<string> {
    return (await this.getRepository()).default_branch;
  }

  public async getEnabledMergeMethods(): Promise<Set<MergeMethod>> {
    const repo = await this.getRepository();
    const set = new Set();
    if (repo.allow_merge_commit) {
      set.add('merge');
    }
    if (repo.allow_squash_merge) {
      set.add('squash');
    }
    if (repo.allow_rebase_merge) {
      set.add('rebase');
    }
    return set;
  }

  public async getPullRequestForCurrentBranch(): Promise<PullRequest|undefined> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd, this.hostname);
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

  public async hasPullRequestForCurrentBranch(): Promise<boolean> {
    return Boolean(await this.getPullRequestForCurrentBranch());
  }

  public async getCombinedStatusForPullRequest(): Promise<PullRequestStatus |undefined> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd, this.hostname);
    const branch = await git.getCurrentBranch(this.cwd);
    if (!branch) {
      return undefined;
    }
    const response = await this.github.getStatusForRef(owner, repository, branch);
    return response.body.total_count > 0 ? response.body.state : undefined;
  }

  public async createPullRequest(upstream?: {owner: string, repository: string, branch: string}):
      Promise<PullRequest|undefined> {
    if (await this.hasPullRequestForCurrentBranch()) {
      return undefined;
    }
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd, this.hostname);
    const branch = await git.getCurrentBranch(this.cwd);
    if (!branch) {
      throw new Error('No current branch');
    }
    this.log(`Create pull request on branch ${branch}`);
    const firstCommit = await git.getFirstCommitOnBranch(branch, this.cwd);
    this.log(`First commit on branch ${firstCommit}`);
    const requestBody = await git.getPullRequestBody(firstCommit, this.cwd);
    if (!requestBody) {
      vscode.window.showWarningMessage(
        `For some unknown reason no pull request body could be build; Aborting operation`);
      return undefined;
    }
    const body: CreatePullRequestBody = {
      title: await git.getCommitMessage(firstCommit, this.cwd),
      head: `${owner}:${branch}`,
      base: upstream ? upstream.branch : await this.getDefaultBranch(),
      body: requestBody
    };
    this.channel.appendLine('Create pull request:');
    this.channel.appendLine(JSON.stringify(body, undefined, ' '));

    if (upstream) {
      return await this.doCreatePullRequest(upstream.owner, upstream.repository, body);
    }
    return await this.doCreatePullRequest(owner, repository, body);
  }

  private async doCreatePullRequest(upstreamOwner: string, upstreamRepository: string,
      body: CreatePullRequestBody): Promise<PullRequest|undefined> {
    try {
      const result = await this.github.createPullRequest(upstreamOwner, upstreamRepository, body);
      // tslint:disable-next-line:comment-format
      // TODO: Pretend should optionally redirect
      const expr = new RegExp(`${this.apiEndpoint}/repos/[^/]+/[^/]+/pulls/([0-9]+)`);
      const number = expr.exec(result.headers['location'][0]) as RegExpMatchArray;
      return (await this.github
        .getPullRequest(upstreamOwner, upstreamRepository, parseInt(number[1], 10)))
        .body;
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
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd, this.hostname);
    const parameters: ListPullRequestsParameters = {
      state: 'open'
    };
    return (await this.github.listPullRequests(owner, repository, parameters)).body;
  }

  public async mergePullRequest(pullRequest: PullRequest, method: MergeMethod): Promise<boolean|undefined> {
    try {
      if (pullRequest.mergeable) {
        const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd, this.hostname);
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

  public async getGithubSlug(): Promise<string> {
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd, this.hostname);
    return `${owner}/${repo}`;
  }

  public async addAssignee(issue: number, name: string): Promise<void> {
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd, this.hostname);
    await this.github.addAssignees(owner, repo, issue, {assignees: [name]});
  }

  public async removeAssignee(issue: number, name: string): Promise<void> {
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd, this.hostname);
    await this.github.removeAssignees(owner, repo, issue, {assignees: [name]});
  }

  public async requestReview(issue: number, name: string): Promise<void> {
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd, this.hostname);
    await this.github.requestReview(owner, repo, issue, {reviewers: [name]});
  }

  public async deleteReviewRequest(issue: number, name: string): Promise<void> {
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd, this.hostname);
    await this.github.deleteReviewRequest(owner, repo, issue, {reviewers: [name]});
  }

}

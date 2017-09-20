import { component, inject } from 'tsdi';
import * as vscode from 'vscode';

import * as git from './git';
import {
  Client,
  ListPullRequestsParameters,
  CreatePullRequestBody,
  MergeMethod,
  MergeBody
} from './provider/client';
import { PullRequest } from './provider/pull-request';
import { Repository } from './provider/repository';

import {
  GitHub,
  GitHubError,
  PullRequestStruct,
  PullRequestStatus,
  Issue,
  PullRequestComment
} from './provider/github';
import { GithubClient } from './provider/github/client';

export interface Tokens {
  [host: string]: {
    token: string;
    provider: 'github' | 'gitlab';
  };
}

@component
export class WorkflowManager {

  @inject('vscode.WorkspaceFolder')
  private folder: vscode.WorkspaceFolder;

  @inject('vscode.OutputChannel')
  private channel: vscode.OutputChannel;

  private provider: Client;

  private github: GitHub;

  private get cwd(): string {
    return this.folder.uri.fsPath;
  }

  private log(message: string): void {
    this.channel.appendLine(message);
    console.log(message);
  }

  get connected(): boolean {
    return Boolean(this.provider);
  }

  public async getGitHubHostname(): Promise<string> {
    return git.getGitHubHostname(this.cwd);
  }

  public async connect(tokens: Tokens): Promise<void> {
    const hostname = await git.getGitHubHostname(this.cwd);
    this.provider = new GithubClient(await this.getApiEndpoint(), tokens[hostname].token);
    this.github = (this.provider as GithubClient).client;
  }

  private async getApiEndpoint(): Promise<string> {
    const hostname = await git.getGitHubHostname(this.cwd);
    if (hostname === 'github.com') {
      return 'https://api.github.com';
    }
    if (hostname.startsWith('http')) {
      return `${hostname}/api/v3`;
    }
    const protocol = git.getGitHubProtocol(this.cwd);
    return `${protocol}//${hostname}/api/v3`;
  }

  public async getRepository(): Promise<Repository> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    return (await this.provider.getRepository(`${owner}/${repository}`)).body;
  }

  public async getDefaultBranch(): Promise<string> {
    return (await this.getRepository()).defaultBranch;
  }

  public async getEnabledMergeMethods(): Promise<Set<MergeMethod>> {
    const repo = await this.getRepository();
    const set = new Set();
    if (repo.allowMergeCommits) {
      set.add('merge');
    }
    if (repo.allowSquashCommits) {
      set.add('squash');
    }
    if (repo.allowRebaseCommits) {
      set.add('rebase');
    }
    return set;
  }

  public async getPullRequestForCurrentBranch(): Promise<PullRequest|undefined> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    const branch = await git.getCurrentBranch(this.cwd);
    const list = (await this.listPullRequests()).filter(pr => pr.sourceBranch === branch);
    if (list.length !== 1) {
      return undefined;
    }
    return (await this.provider.getPullRequest(`${owner}/${repository}`, list[0].number)).body;
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

  public async createPullRequest(upstream?: {owner: string, repository: string, branch: string}):
      Promise<PullRequest|undefined> {
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
    const requestBody = await git.getPullRequestBody(firstCommit, this.cwd);
    if (requestBody === undefined) {
      vscode.window.showWarningMessage(
        `For some unknown reason no pull request body could be build; Aborting operation`);
      return undefined;
    }
    const body: CreatePullRequestBody = {
      sourceBranch: branch,
      targetBranch: upstream ? upstream.branch : await this.getDefaultBranch(),
      title: await git.getCommitMessage(firstCommit, this.cwd),
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
      body: CreatePullRequestBody): Promise<PullRequest> {
    try {
      return (await this.provider.createPullRequest(`${upstreamOwner}/${upstreamRepository}`, body)).body;
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
    return (await this.provider.listPullRequests(`${owner}/${repository}`, parameters)).body;
  }

  public async mergePullRequest(pullRequest: PullRequest, method: MergeMethod): Promise<boolean|undefined> {
    try {
      if (pullRequest.mergeable) {
        const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
        const body: MergeBody = {
          mergeMethod: method
        };
        const result = await this.provider.mergePullRequest(`${owner}/${repository}`, pullRequest.number, body);
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
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd);
    return `${owner}/${repo}`;
  }

  public async getGithubUrl(): Promise<string> {
    const hostname = await git.getGitHubHostname(this.cwd);
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd);
    return `https://${hostname}/${owner}/${repo}`;
  }

  public async getGithubFileUrl(file: string, line?: number): Promise<string> {
    const hostname = await git.getGitHubHostname(this.cwd);
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd);
    const branch = await git.getCurrentBranch(this.cwd);
    return `https://${hostname}/${owner}/${repo}/blob/${branch}/${file}#L${(line || 0) + 1}`;
  }

  public async addAssignee(issue: number, name: string): Promise<void> {
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd);
    await this.github.addAssignees(owner, repo, issue, {assignees: [name]});
  }

  public async removeAssignee(issue: number, name: string): Promise<void> {
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd);
    await this.github.removeAssignees(owner, repo, issue, {assignees: [name]});
  }

  public async requestReview(issue: number, name: string): Promise<void> {
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd);
    await this.github.requestReview(owner, repo, issue, {reviewers: [name]});
  }

  public async deleteReviewRequest(issue: number, name: string): Promise<void> {
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd);
    await this.github.deleteReviewRequest(owner, repo, issue, {reviewers: [name]});
  }

  public async issues(): Promise<Issue[]> {
    const [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd);
    const result = await this.github.issues(owner, repo, {
      sort: 'updated',
      direction: 'desc'
    });
    return result.body
      .filter(issue => !Boolean(issue.pull_request));
  }

  public async getPullRequestReviewComments(pullRequest: PullRequestStruct): Promise<PullRequestComment[]> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    return (await this.github.getPullRequestComments(owner, repository, pullRequest.number)).body;
  }

}

import * as vscode from 'vscode';
import * as git from './git';
import {getClient, GitHub, PullRequest, ListPullRequestsParameters, CreatePullRequestBody} from './github';

export class GitHubManager {

  private cwd: string;

  private channel: vscode.OutputChannel;

  private github: GitHub;

  constructor(cwd: string, channel: vscode.OutputChannel) {
    this.cwd = cwd;
    this.channel = channel;
  }

  get connected(): boolean {
    return Boolean(this.github);
  }

  public connect(token: string): void {
    this.github = getClient(token);
  }

  public async hasPullRequestForCurrentBranch(): Promise<boolean> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    const branch = await git.getCurrentBranch(this.cwd);
    const parameters: ListPullRequestsParameters = {
      state: 'open',
      head: `${owner}:${branch}`
    };
    const response = await this.github.listPullRequests(owner, repository, parameters);
    return response.length > 0;
  }

  public async getCombinedStatusForPullRequest(): Promise<'failure' | 'pending' | 'success' |undefined> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    const branch = await git.getCurrentBranch(this.cwd);
    if (!branch) {
      return undefined;
    }
    const response = await this.github.getStatusForRef(owner, repository, branch);
    return response.state;
  }

  public async createPullRequest(): Promise<PullRequest|undefined> {
    if (await this.hasPullRequestForCurrentBranch()) {
      return undefined;
    }
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    const branch = await git.getCurrentBranch(this.cwd);
    const body: CreatePullRequestBody = {
      title: await git.getCommitMessage(this.cwd),
      head: `${owner}:${branch}`,
      base: `master`
    };
    this.channel.appendLine('Create pull request:');
    this.channel.appendLine(JSON.stringify(body, undefined, ' '));
    return this.github.createPullRequest(owner, repository, body);
  }

  public async listPullRequests(): Promise<PullRequest[]> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    const parameters: ListPullRequestsParameters = {
      state: 'open'
    };
    return await this.github.listPullRequests(owner, repository, parameters);
  }

}

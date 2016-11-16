import * as vscode from 'vscode';
import * as git from './git';
import {getClient, GitHub, GitHubError, PullRequest, ListPullRequestsParameters, CreatePullRequestBody,
  PullRequestStatus, Merge, MergeMethod} from './github';

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
    const body: CreatePullRequestBody = {
      title: await git.getCommitMessage(this.cwd),
      head: `${owner}:${branch}`,
      base: `master`
    };
    this.channel.appendLine('Create pull request:');
    this.channel.appendLine(JSON.stringify(body, undefined, ' '));

    const result = await this.github.createPullRequest(owner, repository, body);
    // TODO: Pretend should optionally redirect
    const number = result.headers['location'][0]
      .match(/https:\/\/api.github.com\/repos\/[^\/]+\/[^\/]+\/pulls\/([0-9]+)/) as RegExpMatchArray;
    return (await this.github.getPullRequest(owner, repository, parseInt(number[1] as string, 10))).body;
  }

  public async listPullRequests(): Promise<PullRequest[]> {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
    const parameters: ListPullRequestsParameters = {
      state: 'open'
    };
    return (await this.github.listPullRequests(owner, repository, parameters)).body;
  }

  public async mergePullRequest(method: MergeMethod): Promise<boolean|undefined> {
    try {
      const pullRequest = await this.getPullRequestForCurrentBranch();
      if (pullRequest && pullRequest.mergeable) {
        const [owner, repository] = await git.getGitHubOwnerAndRepository(this.cwd);
        const pullRequest = await this.getPullRequestForCurrentBranch();
        if (pullRequest) {
          const body: Merge = {
            merge_method: method
          };
          const result = await this.github.mergePullRequest(owner, repository, pullRequest.number, body);
          return result.body.merged;
        }
      }
      return undefined;
    } catch (e) {
      if (!(e instanceof GitHubError)) {
        throw e;
      }
      console.log(e);
      console.log(e.response);
      console.log(await e.response.json());
      // status 405 (method not allowed)
      // TODO...
      return false;
    }
  }

}

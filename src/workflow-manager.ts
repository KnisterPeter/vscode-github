import { component, inject } from 'tsdi';
import * as vscode from 'vscode';

import { Git } from './git';
import { createClient, Client } from './provider/client';
import { Issue } from './provider/issue';
import { PullRequest, MergeBody, MergeMethod, Comment } from './provider/pull-request';
import { Repository, ListPullRequestsParameters, CreatePullRequestBody } from './provider/repository';

import { GitHubError } from './provider/github';

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

  @inject
  private git: Git;

  private provider: Client;

  private get cwd(): string {
    return this.folder.uri.fsPath;
  }

  private log(message: string): void {
    this.channel.appendLine(message);
    console.log(message);
  }

  public get connected(): boolean {
    return Boolean(this.provider);
  }

  public async connect(tokens: Tokens): Promise<void> {
    this.provider = await createClient(this.git, tokens);
    this.log(`Connected with provider ${this.provider.name}`);
  }

  public async getRepository(): Promise<Repository> {
    const [owner, repository] = await this.git.getGitProviderOwnerAndRepository();
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
    const branch = await this.git.getCurrentBranch();
    const list = (await this.listPullRequests()).filter(pr => pr.sourceBranch === branch);
    if (list.length !== 1) {
      return undefined;
    }
    const repository = await this.getRepository();
    return (await repository.getPullRequest(list[0].number)).body;
  }

  public async hasPullRequestForCurrentBranch(): Promise<boolean> {
    return Boolean(await this.getPullRequestForCurrentBranch());
  }

  public async createPullRequest(upstream?: {owner: string, repository: string, branch: string}):
      Promise<PullRequest|undefined> {
    if (await this.hasPullRequestForCurrentBranch()) {
      return undefined;
    }
    const branch = await this.git.getCurrentBranch();
    if (!branch) {
      throw new Error('No current branch');
    }
    const defaultBranch = await this.getDefaultBranch();
    this.log(`Create pull request on branch '${branch}'`);
    const firstCommit = await this.git.getFirstCommitOnBranch(branch, defaultBranch);
    this.log(`First commit on branch '${firstCommit}'`);
    const requestBody = await this.git.getPullRequestBody(firstCommit);
    if (requestBody === undefined) {
      vscode.window.showWarningMessage(
        `For some unknown reason no pull request body could be build; Aborting operation`);
      return undefined;
    }

    return await this.createPullRequestFromData({
      upstream,
      sourceBranch: branch,
      targetBranch: upstream ? upstream.branch : defaultBranch,
      title: await this.git.getCommitMessage(firstCommit),
      body: requestBody
    });
  }

  public async createPullRequestFromData(
      {
        upstream,
        sourceBranch,
        targetBranch,
        title,
        body
      }:
      {
        upstream?: {owner: string, repository: string};
        sourceBranch: string;
        targetBranch: string;
        title: string;
        body?: string;
      }
  ): Promise<PullRequest|undefined> {
    if (await this.hasPullRequestForCurrentBranch()) {
      return undefined;
    }
    this.log(`Create pull request on branch '${sourceBranch}'`);
    const pullRequestBody: CreatePullRequestBody = {
      sourceBranch,
      targetBranch,
      title,
      body
    };
    this.channel.appendLine('Create pull request:');
    this.channel.appendLine(JSON.stringify(pullRequestBody, undefined, ' '));

    const getRepository = async() => {
      if (upstream) {
        return (await this.provider.getRepository(`${upstream.owner}/${upstream.repository}`)).body;
      } else {
        return await this.getRepository();
      }
    };
    return await this.doCreatePullRequest(await getRepository(), pullRequestBody);
  }

  private async doCreatePullRequest(repository: Repository,
      body: CreatePullRequestBody): Promise<PullRequest> {
    try {
      return (await repository.createPullRequest(body)).body;
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
    const repository = await this.getRepository();
    const parameters: ListPullRequestsParameters = {
      state: 'open'
    };
    return (await repository.getPullRequests(parameters)).body;
  }

  public async mergePullRequest(pullRequest: PullRequest, method: MergeMethod): Promise<boolean|undefined> {
    try {
      if (pullRequest.mergeable) {
        const body: MergeBody = {
          mergeMethod: method
        };
        const result = await pullRequest.merge(body);
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

  public async getRepositoryUrl(): Promise<string> {
    const repository = await this.getRepository();
    return repository.url;
  }

  public async getGithubFileUrl(file: string, line?: number): Promise<string> {
    const hostname = await this.git.getGitHostname();
    const [owner, repo] = await this.git.getGitProviderOwnerAndRepository();
    const branch = await this.git.getCurrentBranch();
    const currentFile = file.replace(/^\//, '');
    return `https://${hostname}/${owner}/${repo}/blob/${branch}/${currentFile}#L${(line || 0) + 1}`;
  }

  public async addAssignee(pullRequest: PullRequest, name: string): Promise<void> {
    const user = await this.provider.getUserByUsername(name);
    await pullRequest.assign([user.body]);
  }

  public async removeAssignee(pullRequest: PullRequest): Promise<void> {
    await pullRequest.unassign();
  }

  public async requestReview(issue: number, name: string): Promise<void> {
    const repository = await this.getRepository();
    const pullRequest = await repository.getPullRequest(issue);
    await pullRequest.body.requestReview({
      reviewers: [name]
    });
  }

  public async deleteReviewRequest(issue: number, name: string): Promise<void> {
    const repository = await this.getRepository();
    const pullRequest = await repository.getPullRequest(issue);
    await pullRequest.body.cancelReview({
      reviewers: [name]
    });
  }

  public async issues(): Promise<Issue[]> {
    const repository = await this.getRepository();
    const result = await repository.getIssues({
      sort: 'updated',
      direction: 'desc'
    });
    return result.body;
  }

  public async getPullRequestReviewComments(pullRequest: PullRequest): Promise<Comment[]> {
    return (await pullRequest.getComments()).body;
  }

}

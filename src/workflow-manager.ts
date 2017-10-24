import { component, inject } from 'tsdi';
import * as vscode from 'vscode';

import { Git } from './git';
import { createClient, Client } from './provider/client';
import { Issue, IssueComment } from './provider/issue';
import { PullRequest, MergeBody, MergeMethod, Comment } from './provider/pull-request';
import { Repository, ListPullRequestsParameters, CreatePullRequestBody } from './provider/repository';
import { User } from './provider/user';
import { getTokens } from './tokens';

import { GitHubError } from './provider/github/api';

export interface Tokens {
  [host: string]: {
    token: string;
    provider: 'github' | 'gitlab';
  };
}

@component
export class WorkflowManager {

  @inject({name: 'vscode.ExtensionContext'})
  private context: vscode.ExtensionContext;

  @inject('vscode.OutputChannel')
  private channel: vscode.OutputChannel;

  @inject
  private git: Git;

  private providers: {[cwd: string]: Client} = {};

  private async connect(uri: vscode.Uri): Promise<void> {
    const logger = (message: string) => this.log(message);
    const provider = await createClient(this.git, getTokens(this.context.globalState), uri, logger);
    try {
      provider.test();
    } catch (e) {
      throw new Error(`Connection with ${provider.name} failed. Please make sure your git executable`
        + `is setup correct, and your token has enought access rights.`);
    }
    this.log(`Connected with provider ${provider.name}`);
    this.providers[uri.fsPath] = provider;
  }

  private async getProvider(uri: vscode.Uri): Promise<Client> {
    if (!this.providers[uri.fsPath]) {
      await this.connect(uri);
    }
    return this.providers[uri.fsPath];
  }

  private log(message: string, obj?: any): void {
    const formatted = `${message} ` + (obj ? JSON.stringify(obj, undefined, ' ') : '');
    this.channel.appendLine(formatted);
    console.log(formatted);
  }

  public async canConnect(uri: vscode.Uri): Promise<boolean> {
    try {
      await this.getProvider(uri);
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getRepository(uri: vscode.Uri): Promise<Repository> {
    const [owner, repository] = await this.git.getGitProviderOwnerAndRepository(uri);
    const provider = await this.getProvider(uri);
    return (await provider.getRepository(uri, `${owner}/${repository}`)).body;
  }

  public async getDefaultBranch(uri: vscode.Uri): Promise<string> {
    return (await this.getRepository(uri)).defaultBranch;
  }

  public async getEnabledMergeMethods(uri: vscode.Uri): Promise<Set<MergeMethod>> {
    const repo = await this.getRepository(uri);
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

  public async getPullRequestForCurrentBranch(uri: vscode.Uri): Promise<PullRequest|undefined> {
    const branch = await this.git.getCurrentBranch(uri);
    const list = (await this.listPullRequests(uri)).filter(pr => pr.sourceBranch === branch);
    if (list.length !== 1) {
      return undefined;
    }
    const repository = await this.getRepository(uri);
    return (await repository.getPullRequest(list[0].number)).body;
  }

  public async hasPullRequestForCurrentBranch(uri: vscode.Uri): Promise<boolean> {
    return Boolean(await this.getPullRequestForCurrentBranch(uri));
  }

  public async createPullRequest(uri: vscode.Uri, upstream?: {owner: string, repository: string, branch: string}):
      Promise<PullRequest|undefined> {
    if (await this.hasPullRequestForCurrentBranch(uri)) {
      return undefined;
    }
    const branch = await this.git.getCurrentBranch(uri);
    if (!branch) {
      throw new Error('No current branch');
    }
    const defaultBranch = await this.getDefaultBranch(uri);
    this.log(`Create pull request on branch '${branch}'`);
    const firstCommit = await this.git.getFirstCommitOnBranch(branch, defaultBranch, uri);
    this.log(`First commit on branch '${firstCommit}'`);
    const requestBody = await this.git.getPullRequestBody(firstCommit, uri);
    if (requestBody === undefined) {
      vscode.window.showWarningMessage(
        `For some unknown reason no pull request body could be build; Aborting operation`);
      return undefined;
    }

    return await this.createPullRequestFromData(
      {
        upstream,
        sourceBranch: branch,
        targetBranch: upstream ? upstream.branch : defaultBranch,
        title: await this.git.getCommitMessage(firstCommit, uri),
        body: requestBody
      },
      uri
    );
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
      },
      uri: vscode.Uri
  ): Promise<PullRequest|undefined> {
    if (await this.hasPullRequestForCurrentBranch(uri)) {
      return undefined;
    }
    this.log(`Create pull request on branch '${sourceBranch}'`);
    const pullRequestBody: CreatePullRequestBody = {
      sourceBranch,
      targetBranch,
      title,
      body
    };
    this.log('pull request body:', pullRequestBody);

    const getRepository = async() => {
      if (upstream) {
        const provider = await this.getProvider(uri);
        return (await provider.getRepository(uri, `${upstream.owner}/${upstream.repository}`)).body;
      } else {
        return await this.getRepository(uri);
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
        this.log('Create pull request error:', e.response);
      }
      throw e;
    }
  }

  public async updatePullRequest(pullRequest: PullRequest, uri: vscode.Uri): Promise<void> {
    if (await this.hasPullRequestForCurrentBranch(uri)) {
      return undefined;
    }
    const branch = await this.git.getCurrentBranch(uri);
    if (!branch) {
      throw new Error('No current branch');
    }
    this.log(`Update pull request on branch '${branch}'`);
    const firstCommit = await this.git.getFirstCommitOnBranch(branch, pullRequest.targetBranch, uri);
    this.log(`First commit on branch '${firstCommit}'`);
    const requestBody = await this.git.getPullRequestBody(firstCommit, uri);
    if (requestBody === undefined) {
      vscode.window.showWarningMessage(
        `For some unknown reason no pull request body could be build; Aborting operation`);
      return undefined;
    }
    if (requestBody !== pullRequest.body) {
      await pullRequest.update({
        title: await this.git.getCommitMessage(firstCommit, uri),
        body: requestBody
      });
    }
  }

  public async listPullRequests(uri: vscode.Uri): Promise<PullRequest[]> {
    const repository = await this.getRepository(uri);
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
      this.log('Error while merging:', await e.response.json());
      // status 405 (method not allowed)
      // tslint:disable-next-line:comment-format
      // TODO...
      return false;
    }
  }

  public async getRepositoryUrl(uri: vscode.Uri): Promise<string> {
    const repository = await this.getRepository(uri);
    return repository.url;
  }

  public async getIssueUrl(uri: vscode.Uri, id: string): Promise<string | undefined> {
    const hostname = await this.git.getGitHostname(uri);
    const [owner, repo] = await this.git.getGitProviderOwnerAndRepository(uri);
    return `https://${hostname}/${owner}/${repo}/issues/${id}`;
  }

  public async getGithubFileUrl(uri: vscode.Uri, file: string, line = 0): Promise<string> {
    const hostname = await this.git.getGitHostname(uri);
    const [owner, repo] = await this.git.getGitProviderOwnerAndRepository(uri);
    const branch = await this.git.getCurrentBranch(uri);
    const currentFile = file.replace(/^\//, '');
    return `https://${hostname}/${owner}/${repo}/blob/${branch}/${currentFile}#L${line + 1}`;
  }

  public async getAssignees(uri: vscode.Uri): Promise<User[]> {
    const repository = await this.getRepository(uri);
    try {
      return (await repository.getUsers()).body;
    } catch (e) {
      this.log(e.message);
      return [];
    }
  }

  public async addAssignee(pullRequest: PullRequest, name: string, uri: vscode.Uri): Promise<void> {
    const provider = await this.getProvider(uri);
    const user = await provider.getUserByUsername(name);
    await pullRequest.assign([user.body]);
  }

  public async removeAssignee(pullRequest: PullRequest): Promise<void> {
    await pullRequest.unassign();
  }

  public async requestReview(issue: number, name: string, uri: vscode.Uri): Promise<void> {
    const repository = await this.getRepository(uri);
    const pullRequest = await repository.getPullRequest(issue);
    await pullRequest.body.requestReview({
      reviewers: [name]
    });
  }

  public async deleteReviewRequest(issue: number, name: string, uri: vscode.Uri): Promise<void> {
    const repository = await this.getRepository(uri);
    const pullRequest = await repository.getPullRequest(issue);
    await pullRequest.body.cancelReview({
      reviewers: [name]
    });
  }

  public async issues(uri: vscode.Uri, state: 'closed' | 'all' | 'open' = 'all'): Promise<Issue[]> {
    const repository = await this.getRepository(uri);
    const result = await repository.getIssues({
      sort: 'updated',
      direction: 'desc',
      state
    });
    return result.body;
  }

  public async getPullRequestReviewComments(pullRequest: PullRequest): Promise<Comment[]> {
    return (await pullRequest.getComments()).body;
  }

  public async getIssueComments(issue: Issue): Promise<IssueComment[]> {
    return (await issue.comments()).body;
  }

}

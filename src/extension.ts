import {join} from 'path';
import * as sander from 'sander';
import * as vscode from 'vscode';

import * as git from './git';
import {GitHubError, PullRequest, MergeMethod} from './github';
import {GitHubManager} from './github-manager';
import {StatusBarManager} from './status-bar-manager';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(new Extension(context));
}

type MergeOptionItems = { label: string; description: string; method: MergeMethod; };

class Extension {

  private channel: vscode.OutputChannel;

  private githubManager: GitHubManager;

  private statusBarManager: StatusBarManager;

  constructor(context: vscode.ExtensionContext) {
    this.channel = vscode.window.createOutputChannel('github');
    context.subscriptions.push(this.channel);
    this.channel.appendLine('Visual Studio Code GitHub Extension');

    this.githubManager = new GitHubManager(this.cwd, this.channel);
    this.statusBarManager = new StatusBarManager(context, this.cwd, this.githubManager, this.channel);

    const token = context.globalState.get<string|undefined>('token');
    if (token) {
      this.githubManager.connect(token);
    }
    this.checkVersionAndToken(context, token);

    context.subscriptions.push(
      vscode.commands.registerCommand('vscode-github.browseProject', this.wrapCommand(this.browseProject)),
      vscode.commands.registerCommand('vscode-github.setGitHubToken', this.createGithubTokenCommand(context)),
      vscode.commands.registerCommand('vscode-github.createSimplePullRequest',
        this.wrapCommand(this.createSimplePullRequest)),
      vscode.commands.registerCommand('vscode-github.createPullRequest', this.wrapCommand(this.createPullRequest)),
      vscode.commands.registerCommand('vscode-github.checkoutPullRequests',
        this.wrapCommand(this.checkoutPullRequests)),
      vscode.commands.registerCommand('vscode-github.browserSimplePullRequest',
        this.wrapCommand(this.browseSimplePullRequest)),
      vscode.commands.registerCommand('vscode-github.browserPullRequest', this.wrapCommand(this.browsePullRequest)),
      vscode.commands.registerCommand('vscode-github.mergePullRequest', this.wrapCommand(this.mergePullRequest)),
      vscode.commands.registerCommand('vscode-github.addAssignee', this.wrapCommand(this.addAssignee)),
      vscode.commands.registerCommand('vscode-github.removeAssignee', this.wrapCommand(this.removeAssignee)),
      vscode.commands.registerCommand('vscode-github.requestReview', this.wrapCommand(this.requestReview)),
      vscode.commands.registerCommand('vscode-github.deleteReviewRequest', this.wrapCommand(this.deleteReviewRequest))
    );
  }

  private async withinProgressUI<R>(task: (progress: vscode.Progress<{message?: string}>) => Promise<R>): Promise<R> {
    const options: vscode.ProgressOptions = {
      location: vscode.ProgressLocation.SourceControl,
      title: 'GitHub'
    };
    return vscode.window.withProgress(options, task);
  }

  get cwd(): string {
    if (!vscode.workspace.rootPath) {
      throw new Error('No workspace available');
    }
    return vscode.workspace.rootPath;
  }

  private async checkVersionAndToken(context: vscode.ExtensionContext, token: string|undefined): Promise<void> {
    const content = await sander.readFile(join(context.extensionPath, 'package.json'));
    const version = JSON.parse(content.toString()).version as string;
    const storedVersion = context.globalState.get<string|undefined>('version-test');
    if (version !== storedVersion && !Boolean(token)) {
      context.globalState.update('version-test', version);
      vscode.window.showInformationMessage(
        'To enable the Visual Studio Code GitHub Support, please set a Personal Access Token');
    }
  }

  private wrapCommand<T>(command: T): T {
    const wrap: any = (...args: any[]) => {
      if (this.githubManager.connected && this.cwd) {
        try {
          return (command as any).apply(this, args);
        } catch (e) {
          this.logAndShowError(e);
        }
      } else {
        vscode.window.showWarningMessage('Please setup your Github Personal Access Token '
          + 'and open a GitHub project in your workspace');
      }
    };
    return wrap;
  }

  private logAndShowError(e: Error): void {
      this.channel.appendLine(e.message);
      if (e instanceof GitHubError) {
        console.error(e.response);
        vscode.window.showErrorMessage('GitHub error: ' + e.message);
      } else {
        console.error(e);
        vscode.window.showErrorMessage('Error: ' + e.message);
      }
  }

  private createGithubTokenCommand(context: vscode.ExtensionContext): () => void {
    return async() => {
      const options = {
        ignoreFocusOut: true,
        password: true,
        placeHolder: 'GitHub Personal Access Token'
      };
      const input = await vscode.window.showInputBox(options);
      if (input) {
        context.globalState.update('token', input);
        await this.githubManager.connect(input);
      }
    };
  }

  private async hasRemoteTrackingBranch(): Promise<boolean> {
    const localBranch = await git.getCurrentBranch(this.cwd);
    if (!localBranch) {
      return false;
    }
    return Boolean(await git.getRemoteTrackingBranch(this.cwd, localBranch));
  }

  private async requireRemoteTrackingBranch(): Promise<boolean> {
    const hasBranch = await this.hasRemoteTrackingBranch();
    if (!hasBranch) {
      vscode.window.showWarningMessage(
        `Cannot create pull request without remote branch. Please push you local branch before creating pull request.`);
    }
    return hasBranch;
  }

  private async createSimplePullRequest(): Promise<void> {
    await this.withinProgressUI(async progress => {
      progress.report(`Check preconditions`);
      if (!this.requireRemoteTrackingBranch()) {
        return;
      }
      progress.report(`Create pull requets`);
      const pullRequest = await this.githubManager.createPullRequest();
      if (pullRequest) {
        this.statusBarManager.updateStatus();
        this.showPullRequestNotification(pullRequest);
      }
    });
  }

  private async createPullRequest(): Promise<void> {
    await this.withinProgressUI(async progress => {
      progress.report(`Check preconditions`);
      if (!this.requireRemoteTrackingBranch()) {
        return;
      }
      progress.report(`Gather data`);
      let [owner, repo] = await git.getGitHubOwnerAndRepository(this.cwd);
      const repository = await this.githubManager.getRepository();
      let pullRequest: PullRequest|undefined;
      if (repository.parent) {
        let branch: string;
        const items = [{
          label: repository.full_name,
          description: '',
          branch: repository.default_branch
        }, {
          label: repository.parent.full_name,
          description: '',
          branch: repository.parent.default_branch
        }];
        const selectedRepository = await vscode.window.showQuickPick(items,
          {placeHolder: 'Select a repository to create the pull request in'});
        if (!selectedRepository) {
          return;
        }
        [owner, repo] = selectedRepository.label.split('/');
        branch = selectedRepository.branch;
        progress.report(`Create pull request`);
        pullRequest = await this.githubManager.createPullRequest({
          owner,
          repository: repo,
          branch
        });
      } else {
        pullRequest = await this.githubManager.createPullRequest();
      }
      if (pullRequest) {
        this.statusBarManager.updateStatus();
        this.showPullRequestNotification(pullRequest);
      }
    });
  }

  private async showPullRequestNotification(pullRequest: PullRequest): Promise<void> {
    const result = await vscode.window.showInformationMessage(
      `Successfully created #${pullRequest.number}`, 'Open on Github');
    if (result) {
      vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(pullRequest.html_url));
    }
  }

  private async selectPullRequest(doSomething: (pullRequest: PullRequest) => void): Promise<void> {
    const pullRequests = await this.githubManager.listPullRequests();
    const items = pullRequests.map(pullRequest => ({
      label: pullRequest.title,
      description: `#${pullRequest.number}`,
      pullRequest
    }));
    const selected = await vscode.window.showQuickPick(items);
    if (selected) {
      doSomething(selected.pullRequest);
    }
  }

  private async checkoutPullRequests(): Promise<void> {
    this.selectPullRequest(async pullRequest => {
      await vscode.commands.executeCommand('git.checkout', pullRequest.head.ref);
      this.statusBarManager.updateStatus();
    });
  }

  private async browseProject(): Promise<void> {
    await this.withinProgressUI(async() => {
      const url = await this.githubManager.getGithubUrl();
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    });
  }

  private async browseSimplePullRequest(): Promise<void> {
    await this.withinProgressUI(async() => {
      const pullRequest = await this.githubManager.getPullRequestForCurrentBranch();
      if (pullRequest) {
        await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(pullRequest.html_url));
      } else {
        vscode.window.showInformationMessage('No pull request for current branch found');
      }
    });
  }

  private async browsePullRequest(): Promise<void> {
    this.selectPullRequest(pullRequest => {
      vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(pullRequest.html_url));
    });
  }

  private async getMergeMethdod(): Promise<MergeMethod|undefined> {
    const preferedMethod = vscode.workspace.getConfiguration('github').get<MergeMethod>('preferedMergeMethod');
    if (preferedMethod) {
      return preferedMethod;
    }
    return await this.withinProgressUI(async() => {
      const items: MergeOptionItems[] = [];
      const enabledMethods = await this.githubManager.getEnabledMergeMethods();
      if (enabledMethods.has('merge')) {
        items.push({
          label: 'Create merge commit',
          description: '',
          method: 'merge'
        });
      }
      if (enabledMethods.has('squash')) {
        items.push({
          label: 'Squash and merge',
          description: '',
          method: 'squash'
        });
      }
      if (enabledMethods.has('rebase')) {
        items.push({
          label: 'Rebase and merge',
          description: '',
          method: 'rebase'
        });
      }
      const selected = await vscode.window.showQuickPick(items);
      return selected ? selected.method : undefined;
    });
  }

  private async mergePullRequest(): Promise<void> {
    await this.withinProgressUI(async progress => {
      progress.report(`Check preconditions`);
      const pullRequest = await this.githubManager.getPullRequestForCurrentBranch();
      if (pullRequest && pullRequest.mergeable) {
        const method = await this.getMergeMethdod();
        if (method) {
          progress.report(`Merge pull request`);
          if (await this.githubManager.mergePullRequest(pullRequest, method)) {
            this.statusBarManager.updateStatus();
            vscode.window.showInformationMessage(`Successfully merged`);
          } else {
            vscode.window.showInformationMessage(`Merge failed for unknown reason`);
          }
        }
      } else {
        vscode.window.showWarningMessage(
          'Either no pull request for current brach, or the pull request is not mergable');
      }
    });
  }

  private async addAssignee(): Promise<void> {
    await this.withinProgressUI(async() => {
      const pullRequest = await this.githubManager.getPullRequestForCurrentBranch();
      if (pullRequest) {
        const user = await this.getUser();
        if (user) {
          await this.githubManager.addAssignee(pullRequest.number, user);
          vscode.window.showInformationMessage(`Successfully added ${user} to the assignees`);
        }
      } else {
        vscode.window.showWarningMessage('No pull request for current brach');
      }
    });
  }

  private async removeAssignee(): Promise<void> {
    await this.withinProgressUI(async() => {
      const pullRequest = await this.githubManager.getPullRequestForCurrentBranch();
      if (pullRequest) {
        const user = await this.getUser();
        if (user) {
          await this.githubManager.removeAssignee(pullRequest.number, user);
          vscode.window.showInformationMessage(`Successfully remove ${user} from the assignees`);
        }
      } else {
        vscode.window.showWarningMessage('No pull request for current brach');
      }
    });
  }

  private async requestReview(): Promise<void> {
    await this.withinProgressUI(async() => {
      const pullRequest = await this.githubManager.getPullRequestForCurrentBranch();
      if (pullRequest) {
        const user = await this.getUser();
        if (user) {
          await this.githubManager.requestReview(pullRequest.number, user);
          vscode.window.showInformationMessage(`Successfully requested review from ${user}`);
        }
      } else {
        vscode.window.showWarningMessage('No pull request for current brach');
      }
    });
  }

  private async deleteReviewRequest(): Promise<void> {
    await this.withinProgressUI(async() => {
      const pullRequest = await this.githubManager.getPullRequestForCurrentBranch();
      if (pullRequest) {
        const user = await this.getUser();
        if (user) {
          await this.githubManager.deleteReviewRequest(pullRequest.number, user);
          vscode.window.showInformationMessage(`Successfully canceled review request from ${user}`);
        }
      } else {
        vscode.window.showWarningMessage('No pull request for current brach');
      }
    });
  }

  private async getUser(): Promise<string|undefined> {
    return await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: 'username, email or fullname'
    });
  }

  public dispose(): void {
    //
  }

}

import {join} from 'path';
import * as sander from 'sander';
import * as vscode from 'vscode';
import * as git from './git';
import {GitHubError, PullRequest, MergeMethod} from './github';
import {StatusBarManager} from './status-bar-manager';
import {GitHubManager} from './github-manager';

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
      vscode.commands.registerCommand('extension.setGitHubToken', this.createGithubTokenCommand(context)),
      vscode.commands.registerCommand('extension.createPullRequest', this.wrapCommand(this.createPullRequest)),
      vscode.commands.registerCommand('extension.checkoutPullRequests', this.wrapCommand(this.checkoutPullRequests)),
      vscode.commands.registerCommand('extension.browserPullRequest', this.wrapCommand(this.browserPullRequest)),
      vscode.commands.registerCommand('extension.mergePullRequest', this.wrapCommand(this.mergePullRequest))
    );
  }

  get cwd(): string {
    return vscode.workspace.rootPath;
  }

  private async checkVersionAndToken(context: vscode.ExtensionContext, token: string|undefined): Promise<void> {
    const content = await sander.readFile(join(context.extensionPath, 'package.json'));
    const version = JSON.parse(content).version as string;
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
        vscode.window.showErrorMessage('Error: ' + e.message);
      }
  }

  private createGithubTokenCommand(context: vscode.ExtensionContext): () => void {
    return async () => {
      const options = {
        ignoreFocusOut: true,
        password: true,
        placeHolder: 'GitHub Personal Access Token'
      };
      const input = await vscode.window.showInputBox(options);
      context.globalState.update('token', input);
      this.githubManager.connect(input);
    };
  }

  private async createPullRequest(): Promise<void> {
    const pullRequest = await this.githubManager.createPullRequest();
    if (pullRequest) {
      this.statusBarManager.updatePullRequestStatus();
      vscode.window.showInformationMessage(`Successfully created #${pullRequest.number}`);
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
      await git.checkout(this.cwd, pullRequest.head.ref);
      this.statusBarManager.updatePullRequestStatus();
    });
  }

  private async browserPullRequest(): Promise<void> {
    this.selectPullRequest(pullRequest => {
      vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(pullRequest.html_url));
    });
  }

  private async getMergeMethdod(): Promise<MergeMethod> {
    if (vscode.workspace.getConfiguration('github').has('preferedMergeMethod')) {
      return vscode.workspace.getConfiguration('github').get<MergeMethod>('preferedMergeMethod');
    }
    const items: MergeOptionItems[] = [
      {
        label: 'Create merge commit',
        description: '',
        method: 'merge'
      },
      {
        label: 'Squash and merge',
        description: '',
        method: 'squash'
      },
      {
        label: 'Rebase and merge',
        description: '',
        method: 'rebase'
      }
    ];
    return (await vscode.window.showQuickPick(items)).method;
  }

  private async mergePullRequest(): Promise<void> {
    const pullRequest = await this.githubManager.getPullRequestForCurrentBranch();
    if (pullRequest && pullRequest.mergeable) {
      const method = await this.getMergeMethdod();
      if (method) {
        if (await this.githubManager.mergePullRequest(pullRequest, method)) {
          this.statusBarManager.updatePullRequestStatus();
          vscode.window.showInformationMessage(`Successfully merged`);
        } else {
          vscode.window.showInformationMessage(`Merge failed for unknown reason`);
        }
      }
    } else {
      vscode.window.showWarningMessage(
        'Either no pull request for current brach, or the pull request is not mergable');
    }
  }

  public dispose(): void {
    //
  }

}

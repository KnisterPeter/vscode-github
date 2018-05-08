import { component, inject, initialize } from 'tsdi';
import * as vscode from 'vscode';

import { Git } from './git';
import { getConfiguration } from './helper';
import { GitHubError, PullRequestStatus } from './provider/github/api';
import { PullRequest } from './provider/pull-request';
import { WorkflowManager} from './workflow-manager';

const colors = {
  none: '#ffffff',
  success: '#56e39f',
  failure: '#f24236',
  pending: '#f6f5ae'
};

const githubPullRequestIcon = '$(git-pull-request)';

@component
export class StatusBarManager {

  private get enabled(): boolean {
    const uri = this.getActiveWorkspaceFolder();
    if (!uri) {
      return true;
    }
    return getConfiguration('github', uri).statusbar.enabled;
  }

  private get customStatusBarCommand(): string | null {
    // #202: migrate from statusBarCommand to statusbar.command
    const uri = this.getActiveWorkspaceFolder();
    if (!uri) {
      return null;
    }
    return getConfiguration('github', uri).statusBarCommand || getConfiguration('github', uri).statusbar.command;
  }

  private get refreshInterval(): number {
    // #202: migrate from refreshPullRequestStatus to statusbar.refresh
    const uri = this.getActiveWorkspaceFolder();
    if (!uri) {
      return 0;
    }
    return (getConfiguration('github', uri).refreshPullRequestStatus
      || getConfiguration('github', uri).statusbar.refresh) * 1000;
  }

  private get colored(): boolean {
    const uri = this.getActiveWorkspaceFolder();
    if (!uri) {
      return true;
    }
    return getConfiguration('github', uri).statusbar.color;
  }

  private get successText(): string | undefined {
    const uri = this.getActiveWorkspaceFolder();
    if (!uri) {
      return undefined;
    }
    return getConfiguration('github', uri).statusbar.successText;
  }

  private get pendingText(): string | undefined {
    const uri = this.getActiveWorkspaceFolder();
    if (!uri) {
      return undefined;
    }
    return getConfiguration('github', uri).statusbar.pendingText;
  }

  private get failureText(): string | undefined {
    const uri = this.getActiveWorkspaceFolder();
    if (!uri) {
      return undefined;
    }
    return getConfiguration('github', uri).statusbar.failureText;
  }

  @inject('vscode.ExtensionContext')
  private readonly context!: vscode.ExtensionContext;

  @inject
  private readonly git!: Git;

  private statusBar!: vscode.StatusBarItem;

  @inject
  private readonly workflowManager!: WorkflowManager;

  @inject('vscode.OutputChannel')
  private readonly channel!: vscode.OutputChannel;

  @initialize
  protected init(): void {
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBar.command = this.customStatusBarCommand || '';
    this.statusBar.text = `${githubPullRequestIcon} ...`;
    if (this.colored) {
      this.statusBar.color = colors.none;
    }
    this.context.subscriptions.push(this.statusBar);

    this.refreshStatus()
      .catch(() => { /* drop error (handled in refreshStatus) */ });

    if (!this.enabled) {
      this.statusBar.hide();
    }
  }

  private async refreshStatus(): Promise<void> {
    setTimeout(() => {
      this.refreshStatus()
        .catch(() => { /* drop error (handled in refreshStatus) */ });
    }, this.refreshInterval);
    try {
      const uri = this.getActiveWorkspaceFolder();
      if (uri && await this.workflowManager.canConnect(uri)) {
        await this.updateStatus();
      }
    } catch (e) {
      if (e instanceof GitHubError) {
        console.log(e);
        this.channel.appendLine('Failed to update pull request status:');
        this.channel.appendLine(JSON.stringify(e.response, undefined, ' '));
      } else {
        throw e;
      }
    }
  }

  private getActiveWorkspaceFolder(): vscode.Uri | undefined {
    if (!vscode.workspace.workspaceFolders) {
      // no workspace open
      return undefined;
    }
    if (vscode.workspace.workspaceFolders.length === 1) {
      // just one workspace open
      return vscode.workspace.workspaceFolders[0].uri;
    }
    // check which workspace status should be visible
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!folder) {
      return undefined;
    }
    return folder.uri;
  }

  public async updateStatus(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const uri = this.getActiveWorkspaceFolder();
    if (uri) {
      const branch = await this.git.getCurrentBranch(uri);
      if (branch !== await this.workflowManager.getDefaultBranch(uri)) {
        return this.updatePullRequestStatus(uri);
      }
    }
    this.statusBar.show();
    if (this.colored) {
      this.statusBar.color = colors.none;
    }
    this.statusBar.text = `${githubPullRequestIcon}`;
    if (!this.customStatusBarCommand) {
      this.statusBar.tooltip = 'Not on a pull request branch. Click to checkout pull request';
      this.statusBar.command = 'vscode-github.checkoutPullRequests';
    }
  }

  private async updatePullRequestStatus(uri: vscode.Uri): Promise<void> {
    try {
      const pullRequest = await this.workflowManager.getPullRequestForCurrentBranch(uri);
      this.statusBar.show();
      if (pullRequest) {
        await this.showPullRequestStauts(pullRequest);
      } else {
        this.showCreatePullRequestStatus();
      }
    } catch (e) {
      if (e instanceof GitHubError) {
        console.log(e);
        this.channel.appendLine('Update pull request status error:');
        this.channel.appendLine(JSON.stringify(e.response, undefined, ' '));
      }
      throw e;
    }
  }

  private async showPullRequestStauts(pullRequest: PullRequest): Promise<void> {
    const status = await this.calculateMergableStatus(pullRequest);
    if (this.colored) {
      this.statusBar.color = colors[status];
    }
    this.statusBar.text = this.getPullRequestStautsText(pullRequest, status);
    if (!this.customStatusBarCommand) {
      this.statusBar.tooltip = status === 'success' ? `Merge pull-request #${pullRequest.number}` : '';
      this.statusBar.command = status === 'success' ? 'vscode-github.mergePullRequest' : '';
    }
  }

  // tslint:disable-next-line:cyclomatic-complexity
  private getPullRequestStautsText(pullRequest: PullRequest, status: PullRequestStatus): string {
    let text = '${icon} #${prNumber} ${status}';
    switch (status) {
      case 'success':
        text = this.successText || text;
        break;
      case 'pending':
        text = this.pendingText || text;
        break;
        case 'failure':
        text = this.failureText || text;
        break;
      }
    return text
      .replace('${icon}', githubPullRequestIcon)
      .replace('${prNumber}', String(pullRequest.number))
      .replace('${status}', status);
  }

  private showCreatePullRequestStatus(): void {
    if (this.colored) {
      this.statusBar.color = colors.none;
    }
    this.statusBar.text = `${githubPullRequestIcon} Create PR`;
    if (!this.customStatusBarCommand) {
      this.statusBar.tooltip = 'Create pull-request for current branch';
      this.statusBar.command = 'vscode-github.createPullRequest';
    }
}

  private async calculateMergableStatus(pullRequest: PullRequest): Promise<PullRequestStatus> {
    let status: PullRequestStatus = 'pending';
    if (typeof pullRequest.mergeable === 'undefined') {
      status = 'failure';
    } else {
      if (pullRequest.mergeable) {
        status = 'success';
      } else {
        status = 'failure';
      }
    }
    return status;
  }

}

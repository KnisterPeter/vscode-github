import { component, inject, initialize } from 'tsdi';
import * as vscode from 'vscode';

import { Git } from './git';
import { getConfiguration } from './helper';
import { GitHubError, PullRequestStatus } from './provider/github';
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

  private get customStatusBarCommand(): string | null {
    // #202: migrate from statusBarCommand to statusbar.command
    return getConfiguration().statusBarCommand || getConfiguration().statusbar.command;
  }

  private get refreshInterval(): number {
    // #202: migrate from refreshPullRequestStatus to statusbar.refresh
    return (getConfiguration().refreshPullRequestStatus || getConfiguration().statusbar.refresh) * 1000;
  }

  private get colored(): boolean {
    return getConfiguration().statusbar.color;
  }

  private get successText(): string | undefined {
    return getConfiguration().statusbar.successText;
  }

  private get pendingText(): string | undefined {
    return getConfiguration().statusbar.pendingText;
  }

  private get failureText(): string | undefined {
    return getConfiguration().statusbar.failureText;
  }

  @inject('vscode.ExtensionContext')
  private context: vscode.ExtensionContext;

  @inject('vscode.WorkspaceFolder')
  private folder: vscode.WorkspaceFolder;

  @inject
  private git: Git;

  private statusBar: vscode.StatusBarItem;

  @inject
  private githubManager: WorkflowManager;

  @inject('vscode.OutputChannel')
  private channel: vscode.OutputChannel;

  private get cwd(): string {
    return this.folder.uri.fsPath;
  }

  @initialize
  protected init(): void {
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBar.command = this.customStatusBarCommand || '';
    this.statusBar.text = `${githubPullRequestIcon} ...`;
    if (this.colored) {
      this.statusBar.color = colors.none;
    }
    this.context.subscriptions.push(this.statusBar);

    this.refreshStatus();
  }

  private async refreshStatus(): Promise<void> {
    try {
      if (this.githubManager.connected) {
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
    setTimeout(() => { this.refreshStatus(); }, this.refreshInterval);
  }

  public async updateStatus(): Promise<void> {
    const branch = await this.git.getCurrentBranch();
    if (branch !== await this.githubManager.getDefaultBranch()) {
      this.updatePullRequestStatus();
    } else {
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
  }

  private async updatePullRequestStatus(): Promise<void> {
    try {
      const pullRequest = await this.githubManager.getPullRequestForCurrentBranch();
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

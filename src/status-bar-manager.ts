import { component, inject, initialize } from 'tsdi';
import * as vscode from 'vscode';

import * as git from './git';
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

  private customStatusBarCommand: string | null;

  private refreshInterval: number;

  @inject('vscode.ExtensionContext')
  private context: vscode.ExtensionContext;

  @inject('vscode.WorkspaceFolder')
  private folder: vscode.WorkspaceFolder;

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
    const config = vscode.workspace.getConfiguration('github');
    this.customStatusBarCommand = config.get('statusBarCommand', null);
    this.refreshInterval = config.get('refreshPullRequestStatus', 5) * 1000;

    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBar.command = this.customStatusBarCommand || '';
    this.statusBar.text = `${githubPullRequestIcon} ...`;
    this.statusBar.color = colors.none;
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
    const branch = await git.getCurrentBranch(this.cwd);
    if (branch !== await this.githubManager.getDefaultBranch()) {
      this.updatePullRequestStatus();
    } else {
      this.statusBar.show();
      this.statusBar.color = colors.none;
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
    this.statusBar.color = colors[status];
    this.statusBar.text = `${githubPullRequestIcon} #${pullRequest.number} ${status}`;
    if (!this.customStatusBarCommand) {
      this.statusBar.tooltip = status === 'success' ? `Merge pull-request #${pullRequest.number}` : '';
      this.statusBar.command = status === 'success' ? 'vscode-github.mergePullRequest' : '';
    }
  }

  private showCreatePullRequestStatus(): void {
    this.statusBar.color = colors.none;
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
      const combinedStatus = await this.githubManager.getCombinedStatusForPullRequest();
      if (combinedStatus) {
        status = combinedStatus;
      } else if (pullRequest.mergeable) {
        status = 'success';
      } else {
        status = 'failure';
      }
    }
    return status;
  }

}

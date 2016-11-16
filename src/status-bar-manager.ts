import * as vscode from 'vscode';
import {PullRequest, PullRequestStatus} from './github';
import {GitHubManager} from './github-manager';

const colors = {
  'none': '#ffffff',
  'success': '#56e39f',
  'failure': '#f24236',
  'pending': '#f6f5ae'
};

export class StatusBarManager {

  private statusBar: vscode.StatusBarItem;

  private githubManager: GitHubManager;

  constructor(context: vscode.ExtensionContext, githubManager: GitHubManager) {
    this.githubManager = githubManager;

    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBar.command = '';
    this.statusBar.text = '$(git-pull-request)';
    this.statusBar.color = colors.none;
    context.subscriptions.push(this.statusBar);

    this.refreshPullRequestStatus();
  }

  private async refreshPullRequestStatus(): Promise<void> {
    if (this.githubManager.connected) {
      await this.updatePullRequestStatus();
    }
    setTimeout(() => { this.refreshPullRequestStatus(); }, 5000);
  }

  public async updatePullRequestStatus(): Promise<void> {
    const pullRequest = await this.githubManager.getPullRequestForCurrentBranch();
    this.statusBar.show();
    if (pullRequest) {
      const status = await this.calculateMergableStatus(pullRequest);
      this.statusBar.color = colors[status];
      this.statusBar.tooltip = status === 'success' ? `Merge pull-request #${pullRequest.number}` : '';
      this.statusBar.command = status === 'success' ? 'extension.mergePullRequest' : '';
    } else {
      this.statusBar.color = colors.none;
      this.statusBar.tooltip = 'Create pull-request for current branch';
      this.statusBar.command = 'extension.createPullRequest';
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

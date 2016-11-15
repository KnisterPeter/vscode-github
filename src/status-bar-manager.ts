import * as vscode from 'vscode';
import {GitHubManager} from './github-manager';

const colors = {
  'none': '#888',
  'success': '#0f0',
  'failure': '#f00',
  'pending': '#fff',
  'unknown': '#fff'
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

  public async updatePullRequestStatus(forceState?: boolean): Promise<void> {
    const hasPullRequest = await this.githubManager.hasPullRequestForCurrentBranch();
    this.statusBar.show();
    if (forceState || hasPullRequest) {
      const status = await this.githubManager.getCombinedStatusForPullRequest();
      this.statusBar.color = colors[status || 'unknown'];
      this.statusBar.tooltip = '';
      this.statusBar.command = '';
    } else {
      this.statusBar.color = colors.none;
      this.statusBar.tooltip = 'Create pull-request for current branch';
      this.statusBar.command = 'extension.createPullRequest';
    }
  }

}

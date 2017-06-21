import * as vscode from 'vscode';

import * as git from './git';
import {GitHubError, PullRequest, PullRequestStatus} from './github';
import {GitHubManager} from './github-manager';

const colors = {
  none: '#ffffff',
  success: '#56e39f',
  failure: '#f24236',
  pending: '#f6f5ae'
};

const githubPullRequestIcon = '$(git-pull-request)';

export class StatusBarManager {

  private cwd: string;

  private statusBar: vscode.StatusBarItem;

  private githubManager: GitHubManager;

  private channel: vscode.OutputChannel;

  constructor(context: vscode.ExtensionContext, cwd: string, githubManager: GitHubManager,
      channel: vscode.OutputChannel) {
    this.cwd = cwd;
    this.githubManager = githubManager;
    this.channel = channel;

    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBar.command = '';
    this.statusBar.text = `${githubPullRequestIcon} ...`;
    this.statusBar.color = colors.none;
    context.subscriptions.push(this.statusBar);

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
    setTimeout(() => { this.refreshStatus(); },
      vscode.workspace.getConfiguration('github').get<number>('refreshPullRequestStatus', 5) * 1000);
  }

  public async updateStatus(): Promise<void> {
    const branch = await git.getCurrentBranch(this.cwd);
    if (branch !== await this.githubManager.getDefaultBranch()) {
      this.updatePullRequestStatus();
    } else {
      this.statusBar.show();
      this.statusBar.color = colors.none;
      this.statusBar.text = `${githubPullRequestIcon}`;
      this.statusBar.tooltip = 'Not on a pull request branch. Click to checkout pull request';
      this.statusBar.command = 'vscode-github.checkoutPullRequests';
    }
  }

  private async updatePullRequestStatus(): Promise<void> {
    try {
      const pullRequest = await this.githubManager.getPullRequestForCurrentBranch();
      this.statusBar.show();
      if (pullRequest) {
        const status = await this.calculateMergableStatus(pullRequest);
        this.statusBar.color = colors[status];
        this.statusBar.text = `${githubPullRequestIcon} #${pullRequest.number} ${status}`;
        this.statusBar.tooltip = status === 'success' ? `Merge pull-request #${pullRequest.number}` : '';
        this.statusBar.command = status === 'success' ? 'vscode-github.mergePullRequest' : '';
      } else {
        this.statusBar.color = colors.none;
        this.statusBar.text = `${githubPullRequestIcon} Create PR`;
        this.statusBar.tooltip = 'Create pull-request for current branch';
        this.statusBar.command = 'vscode-github.createPullRequest';
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

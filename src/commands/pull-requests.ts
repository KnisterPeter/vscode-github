import { component, inject } from 'tsdi';
import * as vscode from 'vscode';

import { TokenCommand } from '../command';
import { Git } from '../git';
import { getConfiguration, showProgress } from '../helper';
import { MergeMethod } from '../provider/github';
import { PullRequest } from '../provider/pull-request';
import { StatusBarManager } from '../status-bar-manager';

abstract class PullRequestCommand extends TokenCommand {

  @inject
  protected git: Git;

  protected async selectPullRequest(): Promise<PullRequest | undefined> {
    const pullRequests = await this.workflowManager.listPullRequests();
    const items = pullRequests.map(pullRequest => ({
      label: pullRequest.title,
      description: `#${pullRequest.number}`,
      pullRequest
    }));
    const selected = await vscode.window.showQuickPick(items, {
      matchOnDescription: true
    });
    return selected ? selected.pullRequest : undefined;
  }

  private async hasRemoteTrackingBranch(): Promise<boolean> {
    const localBranch = await this.git.getCurrentBranch();
    if (!localBranch) {
      return false;
    }
    return Boolean(await this.git.getRemoteTrackingBranch(localBranch));
  }

  protected async requireRemoteTrackingBranch(): Promise<boolean> {
    const hasBranch = await this.hasRemoteTrackingBranch();
    if (!hasBranch) {
      if (getConfiguration().autoPublish) {
        await vscode.commands.executeCommand('git.publish');
        return true;
      } else {
        vscode.window.showWarningMessage(
          `Cannot create pull request without remote branch. `
          + `Please push your local branch before creating pull request.`);
      }
    }
    return hasBranch;
  }

  protected async showPullRequestNotification(pullRequest: PullRequest): Promise<void> {
    const result = await vscode.window.showInformationMessage(
      `Successfully created #${pullRequest.number}`, 'Open on Github');
    if (result) {
      vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(pullRequest.url));
    }
  }

}

@component({eager: true})
export class BrowsePullRequest extends PullRequestCommand {

  public id = 'vscode-github.browserPullRequest';

  @showProgress
  protected async runWithToken(): Promise<void> {
    const selected = await this.selectPullRequest();
    if (selected) {
      vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(selected.url));
    }
  }

}

@component({eager: true})
export class BrowseSimpleRequest extends PullRequestCommand {

  public id = 'vscode-github.browserSimplePullRequest';

  @showProgress
  protected async runWithToken(): Promise<void> {
    const pullRequest = await this.workflowManager.getPullRequestForCurrentBranch();
    if (pullRequest) {
      await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(pullRequest.url));
    } else {
      vscode.window.showInformationMessage('No pull request for current branch found');
    }
  }

}

@component({eager: true})
export class CheckoutPullRequest extends PullRequestCommand {

  public id = 'vscode-github.checkoutPullRequests';

  @inject
  private statusBarManager: StatusBarManager;

  @showProgress
  protected async runWithToken(): Promise<void> {
    const selected = await this.selectPullRequest();
    if (selected) {
      await vscode.commands.executeCommand('git.checkout', selected.sourceBranch);
      this.statusBarManager.updateStatus();
    }
  }

}

@component({eager: true})
export class CreatePullRequestWithParameters extends PullRequestCommand {

  public id = 'vscode-github.createPullRequestWithParameters';

  @inject
  private statusBarManager: StatusBarManager;

  @showProgress
  protected async runWithToken(sourceBranch: string, targetBranch: string,
      title: string, body?: string): Promise<void> {
    if (!this.requireRemoteTrackingBranch()) {
      return;
    }
    const pullRequest = await this.workflowManager.createPullRequestFromData({
      sourceBranch,
      targetBranch,
      title,
      body
    });
    if (pullRequest) {
      this.statusBarManager.updateStatus();
      this.showPullRequestNotification(pullRequest);
    }
  }

}

@component({eager: true})
export class CreateSimplePullRequest extends PullRequestCommand {

  public id = 'vscode-github.createSimplePullRequest';

  @inject
  private statusBarManager: StatusBarManager;

  @showProgress
  protected async runWithToken(): Promise<void> {
    if (!this.requireRemoteTrackingBranch()) {
      return;
    }
    const pullRequest = await this.workflowManager.createPullRequest();
    if (pullRequest) {
      this.statusBarManager.updateStatus();
      this.showPullRequestNotification(pullRequest);
    }
  }

}

@component({eager: true})
export class CreatePullRequest extends PullRequestCommand {

  public id = 'vscode-github.createPullRequest';

  @inject
  private statusBarManager: StatusBarManager;

  @showProgress
  protected async runWithToken(): Promise<void> {
    if (!this.requireRemoteTrackingBranch()) {
      return;
    }
    let [owner, repo] = await this.git.getGitProviderOwnerAndRepository();
    const selectedRepository = await this.getRepository();
    if (!selectedRepository) {
      return;
    }
    [owner, repo] = selectedRepository.label.split('/');
    const branch = await this.getTargetBranch(selectedRepository.repo.defaultBranch);
    if (!branch) {
      return;
    }
    const pullRequest = await this.workflowManager.createPullRequest({
      owner,
      repository: repo,
      branch
    });
    if (pullRequest) {
      this.statusBarManager.updateStatus();
      this.showPullRequestNotification(pullRequest);
    }
  }

  private async getRepository(): Promise<{label: string, repo: { defaultBranch: string }} | undefined> {
    const repository = await this.workflowManager.getRepository();
    const items = [{
      label: repository.name,
      description: '',
      repo: repository as { defaultBranch: string }
    }];
    if (repository.parent) {
      items.push({
        label: repository.parent.name,
        description: '',
        repo: repository.parent as { defaultBranch: string }
      });
    }
    if (items.length === 1) {
      return items[0];
    }
    return await vscode.window.showQuickPick(items,
      { placeHolder: 'Select a repository to create the pull request in' });
  }

  private async getTargetBranch(defaultBranch: string): Promise<string | undefined> {
    // sort default branch up
    const picks = (await this.git.getRemoteBranches())
      .sort((b1, b2) => {
        if (b1 === defaultBranch) {
          return -1;
        } else if (b2 === defaultBranch) {
          return 1;
        }
        return b1.localeCompare(b2);
      });
    return await vscode.window.showQuickPick(picks, {
      ignoreFocusOut: true,
      placeHolder: 'Select a branch to create the pull request for'
    });
  }

}

@component({eager: true})
export class MergePullRequest extends PullRequestCommand {

  public id = 'vscode-github.mergePullRequest';

  @inject
  private statusBarManager: StatusBarManager;

  @showProgress
  private async getMergeMethdod(): Promise<MergeMethod | undefined> {
    const config = getConfiguration();
    if (config.preferedMergeMethod) {
      return config.preferedMergeMethod;
    }
    const items: { label: string; description: string; method: MergeMethod; }[] = [];
    const enabledMethods = await this.workflowManager.getEnabledMergeMethods();
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
  }

  @showProgress
  protected async runWithToken(): Promise<void> {
    const pullRequest = await this.workflowManager.getPullRequestForCurrentBranch();
    if (pullRequest && pullRequest.mergeable) {
      const method = await this.getMergeMethdod();
      if (method) {
        if (await this.workflowManager.mergePullRequest(pullRequest, method)) {
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
  }

}

@component({eager: true})
export class UpdatePullRequest extends PullRequestCommand {

  public id = 'vscode-github.updatePullRequest';

  @showProgress
  protected async runWithToken(): Promise<void> {
    const pullRequest = await this.workflowManager.getPullRequestForCurrentBranch();
    if (pullRequest) {
      await this.workflowManager.updatePullRequest(pullRequest);
    } else {
      vscode.window.showInformationMessage('No pull request for current branch found');
    }
  }

}

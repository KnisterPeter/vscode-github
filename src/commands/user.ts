import { component } from 'tsdi';
import * as vscode from 'vscode';

import { TokenCommand } from '../command';
import { showProgress } from '../helper';

abstract class UserCommand extends TokenCommand {

  protected async selectUser(uri: vscode.Uri): Promise<string | undefined> {
    const assignees = await this.workflowManager.getAssignees(uri);
    const picks = assignees.map(assignee => ({
      label: assignee.username,
      description: '',
      assignee
    }));
    picks.push({
      label: 'Other',
      description: '',
      assignee: undefined as any
    });
    const selected = picks.length > 1
      ? await vscode.window.showQuickPick(picks, {
          ignoreFocusOut: true
        })
      : picks[0];
    if (selected) {
      let username: string | undefined;
      if (!selected.assignee) {
        username = await this.getUser();
      } else {
        username = selected.assignee.username;
      }
      return username;
    }
    return undefined;
  }

  protected async getUser(): Promise<string | undefined> {
    return await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: 'username, email or fullname'
    });
  }
}

@component({eager: true})
export class AddAssignee extends UserCommand {

  public id = 'vscode-github.addAssignee';

  @showProgress
  protected async runWithToken(user?: string): Promise<void> {
    const pullRequest = await this.workflowManager.getPullRequestForCurrentBranch(this.uri);
    if (pullRequest) {
      if (!user) {
        user = await this.selectUser(this.uri);
      }
      if (user) {
        await this.workflowManager.addAssignee(pullRequest, user, this.uri);
        vscode.window.showInformationMessage(`Successfully assigned ${user} to the pull request`);
      }
    } else {
      vscode.window.showWarningMessage('No pull request for current brach');
    }
  }

}

@component({eager: true})
export class RemoveAssignee extends UserCommand {

  public id = 'vscode-github.removeAssignee';

  @showProgress
  protected async runWithToken(): Promise<void> {
    const pullRequest = await this.workflowManager.getPullRequestForCurrentBranch(this.uri);
    if (pullRequest) {
      await this.workflowManager.removeAssignee(pullRequest);
      vscode.window.showInformationMessage(`Successfully unassigned the pull request`);
    } else {
      vscode.window.showWarningMessage('No pull request for current brach');
    }
  }

}

@component({eager: true})
export class RequestReview extends UserCommand {

  public id = 'vscode-github.requestReview';

  @showProgress
  protected async runWithToken(user?: string): Promise<void> {
    const pullRequest = await this.workflowManager.getPullRequestForCurrentBranch(this.uri);
    if (pullRequest) {
      if (!user) {
        user = await this.selectUser(this.uri);
      }
      if (user) {
        await this.workflowManager.requestReview(pullRequest.number, user, this.uri);
        vscode.window.showInformationMessage(`Successfully requested review from ${user}`);
      }
    } else {
      vscode.window.showWarningMessage('No pull request for current brach');
    }
  }

}

@component({eager: true})
export class DeleteReviewRequest extends UserCommand {

  public id = 'vscode-github.deleteReviewRequest';

  @showProgress
  protected async runWithToken(user?: string): Promise<void> {
    const pullRequest = await this.workflowManager.getPullRequestForCurrentBranch(this.uri);
    if (pullRequest) {
      if (!user) {
        user = await this.selectUser(this.uri);
      }
      if (user) {
        await this.workflowManager.deleteReviewRequest(pullRequest.number, user, this.uri);
        vscode.window.showInformationMessage(`Successfully canceled review request from ${user}`);
      }
    } else {
      vscode.window.showWarningMessage('No pull request for current brach');
    }
  }

}

import { component } from 'tsdi';
import * as vscode from 'vscode';

import { TokenCommand } from '../command';
import { showProgress } from '../helper';

abstract class UserCommand extends TokenCommand {
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
  protected async runWithToken(): Promise<void> {
    const pullRequest = await this.githubManager.getPullRequestForCurrentBranch();
    if (pullRequest) {
      const user = await this.getUser();
      if (user) {
        await this.githubManager.addAssignee(pullRequest, user);
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
    const pullRequest = await this.githubManager.getPullRequestForCurrentBranch();
    if (pullRequest) {
      await this.githubManager.removeAssignee(pullRequest);
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
  protected async runWithToken(): Promise<void> {
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
  }

}

@component({eager: true})
export class DeleteReviewRequest extends UserCommand {

  public id = 'vscode-github.deleteReviewRequest';

  @showProgress
  protected async runWithToken(): Promise<void> {
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
  }

}

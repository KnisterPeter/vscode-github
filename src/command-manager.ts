import { TSDI, component, inject, initialize } from 'tsdi';
import * as vscode from 'vscode';

import { Command } from './command';
import { BrowseProject, BrowseOpenIssues, BrowseCurrentFile } from './commands/browse';
import {
  BrowsePullRequest,
  BrowseSimpleRequest,
  CheckoutPullRequest,
  CreateSimplePullRequest,
  CreatePullRequest,
  MergePullRequest
} from './commands/pull-requests';
import { SetGithubToken, SetGithubEnterpriseToken } from './commands/token';
import { AddAssignee, RemoveAssignee, RequestReview, DeleteReviewRequest } from './commands/user';

@component
export class CommandManager {

  @inject
  private tsdi: TSDI;

  @inject('vscode.ExtensionContext')
  private context: vscode.ExtensionContext;

  @initialize
  protected init(): void {
    this.register('vscode-github.setGitHubToken', this.tsdi.get(SetGithubToken));
    this.register('vscode-github.setGitHubEnterpriseToken', this.tsdi.get(SetGithubEnterpriseToken));
    this.register('vscode-github.browseProject', this.tsdi.get(BrowseProject));
    this.register('vscode-github.browseOpenIssue', this.tsdi.get(BrowseOpenIssues));
    this.register('vscode-github.browseCurrentFile', this.tsdi.get(BrowseCurrentFile));
    this.register('vscode-github.browserPullRequest', this.tsdi.get(BrowsePullRequest));
    this.register('vscode-github.checkoutPullRequests', this.tsdi.get(CheckoutPullRequest));
    this.register('vscode-github.browserSimplePullRequest', this.tsdi.get(BrowseSimpleRequest));
    this.register('vscode-github.createSimplePullRequest', this.tsdi.get(CreateSimplePullRequest));
    this.register('vscode-github.createPullRequest', this.tsdi.get(CreatePullRequest));
    this.register('vscode-github.mergePullRequest', this.tsdi.get(MergePullRequest));
    this.register('vscode-github.addAssignee', this.tsdi.get(AddAssignee));
    this.register('vscode-github.removeAssignee', this.tsdi.get(RemoveAssignee));
    this.register('vscode-github.requestReview', this.tsdi.get(RequestReview));
    this.register('vscode-github.deleteReviewRequest', this.tsdi.get(DeleteReviewRequest));
  }

  private register(id: string, command: Command): void {
    this.context.subscriptions.push(vscode.commands.registerCommand(id, () => command.run()));
  }

}

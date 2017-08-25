import { inject } from 'tsdi';
import * as vscode from 'vscode';

import { GitHubError } from './github';
import { GitHubManager } from './github-manager';

export abstract class Command {
  public abstract get id(): string;
  public abstract run(progress?: vscode.Progress<{ message?: string }>): void;
}

export abstract class TokenCommand extends Command {

  @inject
  protected githubManager: GitHubManager;

  @inject('vscode.WorkspaceFolder')
  protected folder: vscode.WorkspaceFolder;

  @inject('vscode.OutputChannel')
  private channel: vscode.OutputChannel;

  public async run(progress?: vscode.Progress<{ message?: string | undefined; }>): Promise<void> {
    if (!(this.githubManager && this.githubManager.connected && this.folder)) {
      vscode.window.showWarningMessage('Please setup your Github Personal Access Token '
        + 'and open a GitHub project in your workspace');
      return;
    }
    try {
      await this.runWithToken(progress);
    } catch (e) {
      this.logAndShowError(e);
    }
  }

  protected abstract async runWithToken(progress?: vscode.Progress<{ message?: string | undefined; }>): Promise<void>;

  private logAndShowError(e: Error): void {
    if (this.channel) {
      this.channel.appendLine(e.message);
      if (e.stack) {
        e.stack.split('\n').forEach(line => this.channel.appendLine(line));
      }
    }
    if (e instanceof GitHubError) {
      console.error(e.response);
      vscode.window.showErrorMessage('GitHub error: ' + e.message);
    } else {
      console.error(e);
      vscode.window.showErrorMessage('Error: ' + e.message);
    }
  }
}

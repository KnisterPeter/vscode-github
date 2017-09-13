import { inject } from 'tsdi';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

import { GitHubError } from './provider/github';
import { WorkflowManager } from './workflow-manager';

export abstract class Command {

  @inject
  private reporter: TelemetryReporter;

  public abstract get id(): string;

  public abstract run(progress?: vscode.Progress<{ message?: string }>): void;

  protected track(message: string): void {
    const properties = {
      id: this.id.replace('vscode-github.', ''),
      message
    };
    this.reporter.sendTelemetryEvent('vscode-github.command', properties);
  }
}

export abstract class TokenCommand extends Command {

  @inject
  protected githubManager: WorkflowManager;

  @inject('vscode.WorkspaceFolder')
  protected folder: vscode.WorkspaceFolder;

  @inject('vscode.OutputChannel')
  private channel: vscode.OutputChannel;

  public async run(progress?: vscode.Progress<{ message?: string | undefined; }>): Promise<void> {
    if (!(this.githubManager && this.githubManager.connected && this.folder)) {
      this.track('execute without token');
      vscode.window.showWarningMessage('Please setup your Github Personal Access Token '
        + 'and open a GitHub project in your workspace');
      return;
    }
    this.track('execute');
    try {
      await this.runWithToken(progress);
    } catch (e) {
      this.logAndShowError(e);
    }
  }

  protected abstract async runWithToken(progress?: vscode.Progress<{ message?: string | undefined; }>): Promise<void>;

  private logAndShowError(e: Error): void {
    this.track('failed');
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

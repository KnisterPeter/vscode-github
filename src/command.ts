import { inject } from 'tsdi';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

import { GitHubError } from './provider/github/api';
import { WorkflowManager } from './workflow-manager';

export abstract class Command {
  @inject private readonly reporter!: TelemetryReporter;

  public abstract get id(): string;

  public abstract run(...args: any[]): void;

  protected track(message: string): void {
    const properties = {
      id: this.id.replace('vscode-github.', ''),
      message
    };
    this.reporter.sendTelemetryEvent('vscode-github.command', properties);
  }

  protected async getProjectFolder(): Promise<vscode.Uri | undefined> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) {
      return undefined;
    }
    if (folders.length === 1) {
      return folders[0].uri;
    }
    const folder = await vscode.window.showWorkspaceFolderPick();
    if (!folder) {
      return undefined;
    }
    return folder.uri;
  }
}

export abstract class TokenCommand extends Command {
  @inject protected readonly workflowManager!: WorkflowManager;

  @inject('vscode.OutputChannel')
  private readonly channel!: vscode.OutputChannel;

  protected requireProjectFolder = true;

  protected uri?: vscode.Uri;

  public async run(...args: any[]): Promise<void> {
    if (this.requireProjectFolder) {
      const uri = await this.getProjectFolder();
      if (!uri) {
        return;
      }
      this.uri = uri;
      if (
        !this.workflowManager ||
        !Boolean(await this.workflowManager.canConnect(this.uri))
      ) {
        this.track('execute without token');
        vscode.window.showWarningMessage(
          'Please setup your Github Personal Access Token ' +
            'and open a GitHub project in your workspace'
        );
        return;
      }
    }
    try {
      this.track('execute');
      try {
        await this.runWithToken(...args);
      } catch (e) {
        this.logAndShowError(e);
      }
    } finally {
      this.uri = undefined as any;
    }
  }

  protected abstract runWithToken(...args: any[]): Promise<void>;

  private logAndShowError(e: Error): void {
    this.track('failed');
    if (this.channel) {
      this.channel.appendLine(e.message);
      if (e.stack) {
        e.stack.split('\n').forEach((line) => this.channel.appendLine(line));
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

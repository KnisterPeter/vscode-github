import { join } from 'path';
import * as sander from 'sander';
import { TSDI, component, inject, initialize } from 'tsdi';
import * as vscode from 'vscode';

import { CommandManager } from './command-manager';
import { GitHubError } from './github';
import { GitHubManager, Tokens } from './github-manager';

@component
export class Extension {

  @inject
  private tsdi: TSDI;

  @inject('vscode.ExtensionContext')
  private context: vscode.ExtensionContext;

  @inject('vscode.OutputChannel')
  private channel: vscode.OutputChannel;

  @inject
  private githubManager: GitHubManager;

  @initialize
  protected init(): void {
    try {
      this.migrateToken(this.context);
      this.channel.appendLine('Visual Studio Code GitHub Extension');
      const tokens = this.context.globalState.get<Tokens>('tokens');
      this.checkVersionAndToken(this.context, tokens);

      this.tsdi.get(CommandManager);

      if (!vscode.workspace.workspaceFolders) {
        return;
      }
      if (tokens) {
        this.githubManager.connect(tokens);
      }
    } catch (e) {
      this.logAndShowError(e);
      throw e;
    }
  }

  private migrateToken(context: vscode.ExtensionContext): void {
    const token = context.globalState.get<string | undefined>('token');
    if (token) {
      const tokens = context.globalState.get<Tokens>('tokens', {});
      tokens['github.com'] = token;
      context.globalState.update('tokens', tokens);
      context.globalState.update(token, undefined);
    }
  }

  private async checkVersionAndToken(context: vscode.ExtensionContext, tokens: Tokens | undefined): Promise<void> {
    const content = await sander.readFile(join(context.extensionPath, 'package.json'));
    const version = JSON.parse(content.toString()).version as string;
    const storedVersion = context.globalState.get<string | undefined>('version-test');
    if (version !== storedVersion && (!tokens || Object.keys(tokens).length === 0)) {
      context.globalState.update('version-test', version);
      vscode.window.showInformationMessage(
        'To enable the Visual Studio Code GitHub Support, please set a Personal Access Token');
    }
  }

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

  public dispose(): void {
    //
  }

}

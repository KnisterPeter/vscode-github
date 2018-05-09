import { component, inject } from 'tsdi';
import * as vscode from 'vscode';

import { TokenCommand } from '../command';
import { Git } from '../git';
import { showProgress } from '../helper';

@component({eager: true})
export class BrowseProject extends TokenCommand {

  public id = 'vscode-github.browseProject';

  @showProgress
  protected async runWithToken(): Promise<void> {
    if (!this.uri) {
      throw new Error('uri is undefined');
    }
    const url = await this.workflowManager.getRepositoryUrl(this.uri);
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
  }

}

@component({eager: true})
export class BrowseOpenIssues extends TokenCommand {

  public id = 'vscode-github.browseOpenIssue';

  @showProgress
  protected async runWithToken(): Promise<void> {
    if (!this.uri) {
      throw new Error('uri is undefined');
    }
    const issues = await this.workflowManager.issues(this.uri, 'open');
    if (issues.length > 0) {
      const selected = await vscode.window.showQuickPick(issues.map(issue => ({
        label: `${issue.title}`,
        description: `#${issue.number}`,
        issue
      })));
      if (selected) {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(selected.issue.url));
      }
    } else {
      vscode.window.showInformationMessage(`No open issues found`);
    }
  }

}

@component({eager: true})
export class BrowseCurrentFile extends TokenCommand {

  public id = 'vscode-github.browseCurrentFile';

  @inject
  private readonly git!: Git;

  protected requireProjectFolder = false;

  @showProgress
  protected async runWithToken(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (vscode.workspace.workspaceFolders && editor) {
      const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      if (!folder) {
        return;
      }
      const root = await this.git.getGitRoot(folder.uri);
      const file = editor.document.fileName.substring(root.length);
      const line = editor.selection.active.line;
      const uri = vscode.Uri.parse(await this.workflowManager.getGithubFileUrl(folder.uri, file, line));
      vscode.commands.executeCommand('vscode.open', uri);
    }
  }

}

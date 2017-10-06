import { component } from 'tsdi';
import * as vscode from 'vscode';

import { TokenCommand } from '../command';
import { showProgress } from '../helper';

@component({eager: true})
export class BrowseProject extends TokenCommand {

  public id = 'vscode-github.browseProject';

  @showProgress
  protected async runWithToken(): Promise<void> {
    const url = await this.githubManager.getRepositoryUrl();
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
  }

}

@component({eager: true})
export class BrowseOpenIssues extends TokenCommand {

  public id = 'vscode-github.browseOpenIssue';

  @showProgress
  protected async runWithToken(): Promise<void> {
    const issues = await this.githubManager.issues();
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

  @showProgress
  protected async runWithToken(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (vscode.workspace.workspaceFolders && editor) {
      const file = editor.document.fileName.substring(vscode.workspace.workspaceFolders[0].uri.fsPath.length);
      const line = editor.selection.active.line;
      const uri = vscode.Uri.parse(await this.githubManager.getGithubFileUrl(file, line));
      vscode.commands.executeCommand('vscode.open', uri);
    }
  }

}

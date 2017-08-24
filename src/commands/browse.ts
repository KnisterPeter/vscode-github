import { component } from 'tsdi';
import * as vscode from 'vscode';

import { TokenCommand } from '../command';
import { showProgress } from '../helper';

@component
export class BrowseProject extends TokenCommand {

  @showProgress
  protected async runWithToken(): Promise<void> {
    const url = await this.githubManager.getGithubUrl();
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
  }

}

@component
export class BrowseOpenIssues extends TokenCommand {

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
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(selected.issue.html_url));
      }
    } else {
      vscode.window.showInformationMessage(`No open issues found`);
    }
  }

}

@component
export class BrowseCurrentFile extends TokenCommand {

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

import { component, inject, initialize } from 'tsdi';
import * as vscode from 'vscode';
import { WorkflowManager } from './workflow-manager';

@component
export class HoverProvider implements vscode.DocumentLinkProvider {

  @inject('vscode.ExtensionContext')
  private context: vscode.ExtensionContext;

  @inject
  private workflowManager: WorkflowManager;

  @initialize
  protected init(): void {
    this.context.subscriptions.push(vscode.languages.registerDocumentLinkProvider('*', this));
  }

  public async provideDocumentLinks(document: vscode.TextDocument)
      : Promise<vscode.DocumentLink[]> {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) {
      return [];
    }
    const lines = document
      .getText()
      .split('\n');
    return (await Promise.all(lines.map(async(line, no) => this.getMatchesOnLine(folder.uri, line, no))))
      .reduce((akku, links) => [...akku, ...links], []);
  }

  private async getMatchesOnLine(uri: vscode.Uri, line: string, lineNo: number): Promise<vscode.DocumentLink[]> {
    const expr = new RegExp(`#\\d+`, 'gi');
    let match;
    const matches = [];
    while (true) {
      match = expr.exec(line);
      if (match === null) {
        break;
      }
      const range = new vscode.Range(
        new vscode.Position(lineNo, match.index),
        new vscode.Position(lineNo, match.index + match[0].length)
      );
      const url = await this.workflowManager.getIssueUrl(uri, match[0]);
      if (url) {
        matches.push({
          range,
          target: vscode.Uri.parse(url)
        });
      }
    }
    return matches;
  }
}

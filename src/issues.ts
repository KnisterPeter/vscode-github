import { stripIndents } from 'common-tags';
import { component, inject, initialize } from 'tsdi';
import * as vscode from 'vscode';
import { WorkflowManager } from './workflow-manager';

@component
export class HoverProvider implements vscode.DocumentLinkProvider, vscode.HoverProvider {

  @inject('vscode.ExtensionContext')
  private context: vscode.ExtensionContext;

  @inject
  private workflowManager: WorkflowManager;

  private hoverContent: {[target: string]: string} = {};

  @initialize
  protected init(): void {
    this.context.subscriptions.push(
      vscode.languages.registerDocumentLinkProvider('*', this),
      vscode.languages.registerHoverProvider('*', this)
    );
    vscode.window.onDidChangeActiveTextEditor(() => this.hoverContent = {});
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
      const url = await this.workflowManager.getIssueUrl(uri, match[0].substr(1));
      if (url) {
        matches.push({
          range,
          target: vscode.Uri.parse(url)
        });
      }
    }
    return matches;
  }

  public async provideHover(document: vscode.TextDocument, position: vscode.Position)
      : Promise<vscode.Hover | undefined> {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!folder) {
      return undefined;
    }
    const links = await this.provideDocumentLinks(document);
    const link = links.find(link => link.range.contains(position));
    if (!link || !link.target) {
      return undefined;
    }
    const target = link.target.toString();
    if (this.hoverContent[target]) {
      return new vscode.Hover(this.hoverContent[target], link.range);
    }
    const issues = await this.workflowManager.issues(folder.uri);
    const issue = issues.find(issue => issue.url === target);
    if (!issue) {
      return undefined;
    }
    const comments = await this.workflowManager.getIssueComments(issue);
    const content = stripIndents`

    ## ${issue.title}

    ${issue.body}

    ---

    ${comments.map(comment => comment.body).join('\n\n---\n\n')}
    `;
    this.hoverContent[target] = content;
    return new vscode.Hover(content, link.range);
  }

}

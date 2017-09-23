import { component, inject } from 'tsdi';
import * as vscode from 'vscode';

import { Command } from '../command';
import { WorkflowManager, Tokens } from '../workflow-manager';

@component({eager: true})
export class SetGithubToken extends Command {

  public id = 'vscode-github.setGitHubToken';

  @inject('vscode.ExtensionContext')
  private context: vscode.ExtensionContext;

  @inject
  private githubManager: WorkflowManager;

  public async run(): Promise<void> {
    this.track('execute');
    const options = {
      ignoreFocusOut: true,
      password: true,
      placeHolder: 'GitHub Personal Access Token'
    };
    const input = await vscode.window.showInputBox(options);
    if (input) {
      const tokens = this.context.globalState.get<Tokens>('tokens', {});
      tokens['github.com'] = {
        token: input,
        provider: 'github'
      };
      this.context.globalState.update('tokens', tokens);
      await this.githubManager.connect(tokens);
    }
  }

}

@component({eager: true})
export class SetGitLabToken extends Command {

  public id = 'vscode-github.setGitlabToken';

  @inject('vscode.ExtensionContext')
  private context: vscode.ExtensionContext;

  @inject
  private workflowManager: WorkflowManager;

  public async run(): Promise<void> {
    this.track('execute');
    const hostInput = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: 'GitLab Hostname'
    });
    if (hostInput) {
      const tokenInput = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        password: true,
        placeHolder: 'GitLab Token (Personal Access Tokens)'
      });
      if (tokenInput) {
        const tokens = this.context.globalState.get<Tokens>('tokens', {});
        tokens[hostInput] = {
          token: tokenInput,
          provider: 'gitlab'
        };
        this.context.globalState.update('tokens', tokens);
        this.workflowManager.connect(tokens);
      }
    }
  }

}

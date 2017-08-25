import { component, inject } from 'tsdi';
import * as vscode from 'vscode';

import { Command } from '../command';
import { GitHubManager, Tokens } from '../github-manager';

@component({eager: true})
export class SetGithubToken extends Command {

  public id = 'vscode-github.setGitHubToken';

  @inject('vscode.ExtensionContext')
  private context: vscode.ExtensionContext;

  @inject
  private githubManager: GitHubManager;

  public async run(): Promise<void> {
    const options = {
      ignoreFocusOut: true,
      password: true,
      placeHolder: 'GitHub Personal Access Token'
    };
    const input = await vscode.window.showInputBox(options);
    if (input) {
      const tokens = this.context.globalState.get<Tokens>('tokens', {});
      tokens['github.com'] = input;
      this.context.globalState.update('tokens', tokens);
      await this.githubManager.connect(tokens);
    }
  }

}

@component({eager: true})
export class SetGithubEnterpriseToken extends Command {

  public id = 'vscode-github.setGitHubEnterpriseToken';

  @inject('vscode.ExtensionContext')
  private context: vscode.ExtensionContext;

  @inject
  private githubManager: GitHubManager;

  public async run(): Promise<void> {
    const hostInput = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: 'GitHub Enterprise Hostname'
    });
    if (hostInput) {
      const tokenInput = await vscode.window.showInputBox({
        ignoreFocusOut: true,
        password: true,
        placeHolder: 'GitHub Enterprise Token'
      });
      if (tokenInput) {
        const tokens = this.context.globalState.get<Tokens>('tokens', {});
        tokens[hostInput] = tokenInput;
        this.context.globalState.update('tokens', tokens);
        this.githubManager.connect(tokens);
      }
    }
}

}

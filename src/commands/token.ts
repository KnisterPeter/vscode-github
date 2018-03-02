import { component, inject } from 'tsdi';
import * as vscode from 'vscode';

import { Command } from '../command';
import { getHostname } from '../helper';
import { getTokens, listTokenHosts, removeToken } from '../tokens';

@component({eager: true})
export class SetGithubToken extends Command {

  public id = 'vscode-github.setGitHubToken';

  @inject('vscode.ExtensionContext')
  private context!: vscode.ExtensionContext;

  public async run(): Promise<void> {
    this.track('execute');
    const options = {
      ignoreFocusOut: true,
      password: true,
      placeHolder: 'GitHub Personal Access Token'
    };
    const input = await vscode.window.showInputBox(options);
    if (input) {
      const tokens = getTokens(this.context.globalState);
      tokens['github.com'] = {
        token: input,
        provider: 'github'
      };
      this.context.globalState.update('tokens', tokens);
    }
  }

}

@component({eager: true})
export class SetGithubEnterpriseToken extends Command {

  public id = 'vscode-github.setGitHubEnterpriseToken';

  @inject('vscode.ExtensionContext')
  private context!: vscode.ExtensionContext;

  public async run(): Promise<void> {
    this.track('execute');
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
        const tokens = getTokens(this.context.globalState);
        tokens[getHostname(hostInput)] = {
          token: tokenInput,
          provider: 'github'
        };
        this.context.globalState.update('tokens', tokens);
      }
    }
  }

}

@component({eager: true})
export class SetGitLabToken extends Command {

  public id = 'vscode-github.setGitlabToken';

  @inject('vscode.ExtensionContext')
  private context!: vscode.ExtensionContext;

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
        const tokens = getTokens(this.context.globalState);
        tokens[getHostname(hostInput)] = {
          token: tokenInput,
          provider: 'gitlab'
        };
        this.context.globalState.update('tokens', tokens);
      }
    }
  }

}

@component({eager: true})
export class ClearToken extends Command {

  public id = 'vscode-github.clearToken';

  @inject('vscode.ExtensionContext')
  private context!: vscode.ExtensionContext;

  public async run(): Promise<void> {
    this.track('execute');
    const host = await vscode.window.showQuickPick(listTokenHosts(this.context.globalState), {
      placeHolder: 'Token to remove'
    });
    if (host) {
      removeToken(this.context.globalState, host);
    }
  }

}

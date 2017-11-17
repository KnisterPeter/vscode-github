import * as execa from 'execa';
import { resolve } from 'path';
import { readFile, unlink } from 'sander';
import { component, inject } from 'tsdi';
import { parse } from 'url';
import * as vscode from 'vscode';

import { getConfiguration } from './helper';

@component
export class Git {

  @inject('vscode.OutputChannel')
  private channel: vscode.OutputChannel;

  private getRemoteName(uri: vscode.Uri): string {
    return getConfiguration('github', uri).remoteName;
  }

  private async execute(cmd: string, uri: vscode.Uri): Promise<{stdout: string, stderr: string}> {
    const [git, ...args] = cmd.split(' ');
    const gitCommand = getConfiguration('github', uri).gitCommand;
    this.channel.appendLine(`${gitCommand || git} ${args.join(' ')}`);
    return await execa(gitCommand || git, args, { cwd: uri.fsPath });
  }

  public async checkExistence(uri: vscode.Uri): Promise<boolean> {
    try {
      await this.execute('git --version', uri);
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getRemoteBranches(uri: vscode.Uri): Promise<string[]> {
    const response = await this.execute('git branch --list --remotes --no-color', uri);
    return response.stdout
      .split('\n')
      .filter(line => !line.match('->'))
      .map(line => line.replace(`${this.getRemoteName(uri)}/`, ''))
      .map(line => line.trim());
  }

  /**
   * Check config for a default upstream and if none found look in .git/config for a remote origin and
   * parses it to get username and repository.
   *
   * @return {Promise<string[]>} A tuple of username and repository (e.g. KnisterPeter/vscode-github)
   * @throws Throws if the could not be parsed as a github url
   */
  public async getGitProviderOwnerAndRepository(uri: vscode.Uri): Promise<string[]> {
    const defaultUpstream = getConfiguration('github', uri).upstream;
    if (defaultUpstream) {
      return Promise.resolve(defaultUpstream.split('/'));
    }
    return (await this.getGitProviderOwnerAndRepositoryFromGitConfig(uri)).slice(2, 4);
  }

  public async getGitHostname(uri: vscode.Uri): Promise<string> {
    return (await this.getGitProviderOwnerAndRepositoryFromGitConfig(uri))[1];
  }

  public async getGitProtocol(uri: vscode.Uri): Promise<string> {
    return (await this.getGitProviderOwnerAndRepositoryFromGitConfig(uri))[0];
  }

  private async getGitProviderOwnerAndRepositoryFromGitConfig(uri: vscode.Uri): Promise<string[]> {
    const remote = (await this.execute(`git config --local --get remote.${this.getRemoteName(uri)}.url`, uri))
      .stdout.trim();
    if (!remote.length) {
      throw new Error('Git remote is empty!');
    }
    return this.parseGitUrl(remote);
  }

  public parseGitUrl(remote: string): string[] {
    // git protocol remotes, may be git@github:username/repo.git
    // or git://github/user/repo.git, domain names are not case-sensetive
    if (remote.startsWith('git@') || remote.startsWith('git://')) {
      return this.parseGitProviderUrl(remote);
    }

    return this.getGitProviderOwnerAndRepositoryFromHttpUrl(remote);
  }

  public parseGitProviderUrl(remote: string): string[] {
    const match = new RegExp('^git(?:@|://)([^:/]+)(?::|:/|/)([^/]+)/(.+?)(?:.git)?$', 'i').exec(remote);
    if (!match) {
      throw new Error(`'${remote}' does not seem to be a valid git provider url.`);
    }
    return ['git:', ...match.slice(1, 4)];
  }

  private getGitProviderOwnerAndRepositoryFromHttpUrl(remote: string): string[] {
    // it must be http or https based remote
    const { protocol = 'https:', hostname, pathname } = parse(remote);
    // domain names are not case-sensetive
    if (!hostname || !pathname) {
      throw new Error('Not a Provider remote!');
    }
    const match = pathname.match(/\/(.*?)\/(.*?)(?:.git)?$/);
    if (!match) {
      throw new Error('Not a Provider remote!');
    }
    return [protocol, hostname, ...match.slice(1, 3)];
  }

  public async getCurrentBranch(uri: vscode.Uri): Promise<string|undefined> {
    const stdout = (await this.execute('git branch', uri)).stdout;
    const match = stdout.match(/^\* (.*)$/m);
    return match ? match[1] : undefined;
  }

  public async getCommitMessage(sha: string, uri: vscode.Uri): Promise<string> {
    return (await this.execute(`git log -n 1 --format=%s ${sha}`, uri)).stdout.trim();
  }

  public async getFirstCommitOnBranch(branch: string, defaultBranch: string, uri: vscode.Uri): Promise<string> {
    const sha = (await this.execute(`git rev-list ^${defaultBranch} ${branch}`, uri)).stdout.trim().split('\n')[0];
    if (!sha) {
      return 'master';
    }
    return sha;
  }

  private async getCommitBody(sha: string, uri: vscode.Uri): Promise<string> {
    return (await this.execute(`git log --format=%b -n 1 ${sha}`, uri)).stdout.trim();
  }

  public async getPullRequestBody(sha: string, uri: vscode.Uri): Promise<string|undefined> {
    const bodyMethod = getConfiguration('github', uri).customPullRequestDescription;

    switch (bodyMethod) {
      case 'singleLine':
        return this.getSingleLinePullRequestBody();
      case 'gitEditor':
        return this.getGitEditorPullRequestBody(uri);
      case 'off':
      default:
        return this.getCommitBody(sha, uri);
    }
  }

  private async getSingleLinePullRequestBody(): Promise<string|undefined> {
    return await vscode.window.showInputBox({prompt: 'Pull request description'});
  }

  private async getGitEditorPullRequestBody(uri: vscode.Uri): Promise<string> {
    const path = resolve(uri, 'PR_EDITMSG');

    const [editorName, ...params] = (await execa('git', ['config', '--get', 'core.editor'])).stdout.split(' ');
    await execa(editorName, [...params, path]);

    const fileContents = (await readFile(path)).toString();

    await unlink(path);

    return fileContents;
  }

  public async getRemoteTrackingBranch(branch: string, uri: vscode.Uri): Promise<string|undefined> {
    try {
      return (await this.execute(`git config --get branch.${branch}.merge`, uri)).stdout.trim().split('\n')[0];
    } catch (e) {
      return undefined;
    }
  }
}

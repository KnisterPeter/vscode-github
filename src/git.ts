import * as execa from 'execa';
import { resolve } from 'path';
import { readFile, unlink } from 'sander';
import { component, inject } from 'tsdi';
import { parse } from 'url';
import * as vscode from 'vscode';

import { getConfiguration } from './helper';

@component
export class Git {

  @inject('vscode.WorkspaceFolder')
  protected folder: vscode.WorkspaceFolder;

  @inject('vscode.OutputChannel')
  private channel: vscode.OutputChannel;

  private get remoteName(): string {
    return getConfiguration().remoteName;
  }

  private async execute(cmd: string): Promise<{stdout: string, stderr: string}> {
    const [git, ...args] = cmd.split(' ');
    const gitCommand = getConfiguration().gitCommand;
    this.channel.appendLine(`${gitCommand || git} ${args.join(' ')}`);
    return await execa(gitCommand || git, args, {cwd: this.folder.uri.fsPath});
  }

  public async checkExistence(): Promise<boolean> {
    try {
      await this.execute('git --version');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Check config for a default upstream and if none found look in .git/config for a remote origin and
   * parses it to get username and repository.
   *
   * @param {string} cwd The directory to find the .git/config file in.
   * @return {Promise<string[]>} A tuple of username and repository (e.g. KnisterPeter/vscode-github)
   * @throws Throws if the could not be parsed as a github url
   */
  public async getGitProviderOwnerAndRepository(): Promise<string[]> {
    const defaultUpstream = getConfiguration().upstream;
    if (defaultUpstream) {
      return Promise.resolve(defaultUpstream.split('/'));
    }
    return (await this.getGitProviderOwnerAndRepositoryFromGitConfig()).slice(2, 4);
  }

  public async getGitHostname(): Promise<string> {
    return (await this.getGitProviderOwnerAndRepositoryFromGitConfig())[1];
  }

  public async getGitProtocol(): Promise<string> {
    return (await this.getGitProviderOwnerAndRepositoryFromGitConfig())[0];
  }

  private async getGitProviderOwnerAndRepositoryFromGitConfig(): Promise<string[]> {
    const remote = (await this.execute(`git config --local --get remote.${this.remoteName}.url`))
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

  public async getCurrentBranch(): Promise<string|undefined> {
    const stdout = (await this.execute('git branch')).stdout;
    const match = stdout.match(/^\* (.*)$/m);
    return match ? match[1] : undefined;
  }

  public async getCommitMessage(sha: string): Promise<string> {
    return (await this.execute(`git log -n 1 --format=%s ${sha}`)).stdout.trim();
  }

  public async getFirstCommitOnBranch(branch: string, defaultBranch: string): Promise<string> {
    return (await this.execute(`git rev-list ^${defaultBranch} ${branch}`)).stdout.trim().split('\n')[0];
  }

  public async getCommitBody(sha: string): Promise<string> {
    return (await this.execute(`git log --format=%b -n 1 ${sha}`)).stdout.trim();
  }

  public async getPullRequestBody(sha: string): Promise<string|undefined> {
    const bodyMethod = getConfiguration().customPullRequestDescription;

    switch (bodyMethod) {
      case 'singleLine':
        return this.getSingleLinePullRequestBody();
      case 'gitEditor':
        return this.getGitEditorPullRequestBody();
      case 'off':
      default:
        return this.getCommitBody(sha);
    }
  }

  private async getSingleLinePullRequestBody(): Promise<string|undefined> {
    return await vscode.window.showInputBox({prompt: 'Pull request description'});
  }

  private async getGitEditorPullRequestBody(): Promise<string> {
    const path = resolve(this.folder.uri.fsPath, 'PR_EDITMSG');

    const [editorName, ...params] = (await execa('git', ['config', '--get', 'core.editor'])).stdout.split(' ');
    await execa(editorName, [...params, path]);

    const fileContents = (await readFile(path)).toString();

    await unlink(path);

    return fileContents;
  }

  public async getRemoteTrackingBranch(branch: string): Promise<string|undefined> {
    try {
      return (await this.execute(`git config --get branch.${branch}.merge`)).stdout.trim().split('\n')[0];
    } catch (e) {
      return undefined;
    }
  }
}

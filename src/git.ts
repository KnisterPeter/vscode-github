import * as execa from 'execa';
import { resolve } from 'path';
import { readFile, unlink } from 'sander';
import { parse } from 'url';
import * as vscode from 'vscode';

export async function checkExistence(cwd: string): Promise<boolean> {
  try {
    await execa('git', ['--version'], {cwd});
    return true;
  } catch (e) {
    return false;
  }
}

function getRemoteName(): string {
  return vscode.workspace.getConfiguration('github').get('remoteName', 'origin');
}

/**
 * Check config for a default upstream and if none found look in .git/config for a remote origin and
 * parses it to get username and repository.
 *
 * @param {string} cwd The directory to find the .git/config file in.
 * @return {Promise<string[]>} A tuple of username and repository (e.g. KnisterPeter/vscode-github)
 * @throws Throws if the could not be parsed as a github url
 */
export async function getGitProviderOwnerAndRepository(cwd: string): Promise<string[]> {
  const defaultUpstream = vscode.workspace.getConfiguration('github').get<string|undefined>('upstream', undefined);
  if (defaultUpstream) {
    return Promise.resolve(defaultUpstream.split('/'));
  }
  return (await getGitProviderOwnerAndRepositoryFromGitConfig(cwd)).slice(2, 4);
}

export async function getGitHostname(cwd: string): Promise<string> {
  return (await getGitProviderOwnerAndRepositoryFromGitConfig(cwd))[1];
}

export async function getGitProtocol(cwd: string): Promise<string> {
  return (await getGitProviderOwnerAndRepositoryFromGitConfig(cwd))[0];
}

async function getGitProviderOwnerAndRepositoryFromGitConfig(cwd: string): Promise<string[]> {
  const remote = (await execa('git',
    `config --local --get remote.${getRemoteName()}.url`.split(' '), {cwd})).stdout.trim();
  if (!remote.length) {
    throw new Error('Git remote is empty!');
  }
  return parseGitUrl(remote);
}

export function parseGitUrl(remote: string): string[] {
  // git protocol remotes, may be git@github:username/repo.git
  // or git://github/user/repo.git, domain names are not case-sensetive
  if (remote.startsWith('git@') || remote.startsWith('git://')) {
    return parseGitProviderUrl(remote);
  }

  return getGitProviderOwnerAndRepositoryFromHttpUrl(remote);
}

export function parseGitProviderUrl(remote: string): string[] {
  const match = new RegExp('^git(?:@|://)([^:/]+)(?::|:/|/)([^/]+)/(.+?)(?:.git)?$', 'i').exec(remote);
  if (!match) {
    throw new Error(`'${remote}' does not seem to be a valid git provider url.`);
  }
  return ['git:', ...match.slice(1, 4)];
}

function getGitProviderOwnerAndRepositoryFromHttpUrl(remote: string): string[] {
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

export async function getCurrentBranch(cwd: string): Promise<string|undefined> {
  const stdout = (await execa('git', ['branch'], {cwd})).stdout;
  const match = stdout.match(/^\* (.*)$/m);
  return match ? match[1] : undefined;
}

export async function getCommitMessage(sha: string, cwd: string): Promise<string> {
  return (await execa('git', ['log', '-n', '1', '--format=%s', sha], {cwd})).stdout.trim();
}

export async function getFirstCommitOnBranch(branch: string, cwd: string): Promise<string> {
  const remoteName = getRemoteName();
  return (await execa('git', ['log', '--reverse', '--right-only', '--format=%h',
    `${remoteName}/master..${remoteName}/${branch}`], {cwd})).stdout.trim().split('\n')[0];
}

export async function getCommitBody(sha: string, cwd: string): Promise<string> {
  return (await execa('git', ['log', '--format=%b', '-n', '1', sha], {cwd})).stdout.trim();
}

export async function getPullRequestBody(sha: string, cwd: string): Promise<string|undefined> {
  const bodyMethod = vscode.workspace.getConfiguration('github').get<string>('customPullRequestDescription');

  switch (bodyMethod) {
    case 'singleLine':
      return getSingleLinePullRequestBody();
    case 'gitEditor':
      return getGitEditorPullRequestBody(cwd);
    case 'off':
    default:
      return getCommitBody(sha, cwd);
  }
}

async function getSingleLinePullRequestBody(): Promise<string|undefined> {
  return await vscode.window.showInputBox({prompt: 'Pull request description'});
}

async function getGitEditorPullRequestBody(cwd: string): Promise<string> {
  const path = resolve(cwd, 'PR_EDITMSG');

  const [editorName, ...params] = (await execa('git', ['config', '--get', 'core.editor'])).stdout.split(' ');
  await execa(editorName, [...params, path]);

  const fileContents = (await readFile(path)).toString();

  await unlink(path);

  return fileContents;
}

export async function getRemoteTrackingBranch(cwd: string, branch: string): Promise<string|undefined> {
  try {
    return (await execa('git', ['config', '--get', `branch.${branch}.merge`], {cwd})).stdout.trim().split('\n')[0];
  } catch (e) {
    return undefined;
  }
}

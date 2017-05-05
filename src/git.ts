import * as execa from 'execa';
import { resolve } from 'path';
import { readFile, unlink } from 'sander';
import { parse } from 'url';
import * as vscode from 'vscode';

/**
 * Check config for a default upstream and if none found look in .git/config for a remote origin and
 * parses it to get username and repository.
 *
 * @param {string} cwd The directory to find the .git/config file in.
 * @return {Promise<string[]>} A tuple of username and repository (e.g. KnisterPeter/vscode-github)
 * @throws Throws if the could not be parsed as a github url
 */
export async function getGitHubOwnerAndRepository(cwd: string): Promise<string[]> {
  const defaultUpstream = vscode.workspace.getConfiguration('github').get<string|undefined>('upstream', undefined);
  if (defaultUpstream) {
    return Promise.resolve(defaultUpstream.split('/'));
  }
  return getGitHubOwnerAndRepositoryFromGitConfig(cwd);
}

async function getGitHubOwnerAndRepositoryFromGitConfig(cwd: string): Promise<string[]> {
  // as we expect this function to throw on non-Github repos we can chain
  // whatever calls and they will thrown on non-correct remotes
  const remote = (await execa('git', 'config --local --get remote.origin.url'.split(' '), {cwd})).stdout.trim();
  if (!remote.length) {
    throw new Error('Git remote is empty!');
  }

  // git protocol remotes, may be git@github:username/repo.git
  // or git://github/user/repo.git, GITHUB domain name is not case-sensetive
  if (remote.startsWith('git')) {
    return remote.match(/^git(?:@|\:\/\/)github.com[\/:](.*?)\/(.*?)(?:.git)?$/i)!.slice(1, 3);
  }

  // it must be http or https based remote
  const { hostname, pathname } = parse(remote);
  // github.com domain name is not case-sensetive
  if (!pathname || !hostname || !/^github\.com$/i.test(hostname)) {
    throw new Error('Not a Github remote!');
  }
  return pathname.match(/\/(.*?)\/(.*?)(?:.git)?$/)!.slice(1, 3);
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
  return (await execa('git', ['log', '--reverse', '--right-only', '--format=%h',
    `origin/master..origin/${branch}`], {cwd})).stdout.trim().split('\n')[0];
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

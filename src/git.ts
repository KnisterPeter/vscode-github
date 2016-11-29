import * as execa from 'execa';
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
  const defaultUpstream = vscode.workspace.getConfiguration('github').get<string>('upstream', undefined);
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
  return execa('git', ['branch'], {cwd})
    .then(result => {
      const match = result.stdout.match(/^\* (.*)$/m);
      return match ? match[1] : undefined;
    });
}

export async function getCommitMessage(cwd: string): Promise<string> {
  return execa('git', ['log', '--oneline', '-1'], {cwd})
    .then(result => {
      const match = result.stdout.match(/^(?:.+?) (.*)/);
      return match ? match[1] : result.stdout;
    });
}

export async function checkout(cwd: string, branch: string): Promise<void> {
  return execa('git', ['checkout', branch], {cwd})
    .then(() => undefined);
}

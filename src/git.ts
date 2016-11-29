import * as execa from 'execa';

import { parse } from 'url';

export async function getGitHubOwnerAndRepository(cwd: string): Promise<string[]> {
  // As we expect this function to throw on non-Github repos we can chain whatever calls and they will thrown on non-correct remotes
  const remote = (await execa('git', 'config --local --get remote.origin.url'.split(' '), {cwd})).stdout.trim();
  if (!remote.length) throw new Error('Git remote is empty!');

  // Git protocol remotes, may be git@github or git://github, GITHUB domain name is not case-sensetive
  if(remote.startsWith('git')) return remote.match(/^git(@|\:\/\/)github.com\/(.*?)\/(.*?)(?:.git)?$/i).slice(2, 4);

  // it must be http or https based remote
  const { hostname, pathname } = parse(remote);
  // Github.com domain name is not case-sensetive
  if (!/^github\.com$/i.test(hostname)) throw new Error('Not a Github remote!');
  return pathname.match(/\/(.*?)\/(.*?)(?:.git)?$/).slice(1, 3);
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

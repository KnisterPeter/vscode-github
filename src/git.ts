import * as execa from 'execa';
import * as vscode from 'vscode';

export async function getGitHubOwnerAndRepository(cwd: string): Promise<string[]> {
  const defaultUpstream = vscode.workspace.getConfiguration('github').get<string>('upstream', undefined);
  if (defaultUpstream) {
    return Promise.resolve(defaultUpstream.split('/'));
  }
  return execa('git', ['config', '--get-regexp', 'remote\\.origin\\.url'], {cwd})
    .then(result => {
      const match = result.stdout.match(
        /^remote\.origin\.url (?:git@github\.com:|https:\/\/github.com\/)(.*?)\/(.*?)(?:.git)?$/);
      if (!match) {
        throw new Error('Not a github project?');
      }
      return [match[1], match[2]];
    });
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

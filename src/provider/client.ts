import * as vscode from 'vscode';
import { Git } from '../git';
import { getConfiguration } from '../helper';
import { Tokens } from '../tokens';
import { Repository } from './repository';
import { User } from './user';

import { GithubClient } from './github/client';
import { GitLabClient } from './gitlab/client';

export async function createClient(
  git: Git,
  tokens: Tokens,
  uri: vscode.Uri,
  logger: (message: string) => void
): Promise<Client> {
  const gitProtocol = await git.getGitProtocol(uri);
  const protocol = gitProtocol.startsWith('http') ? gitProtocol : 'https:';
  const hostname = await git.getGitHostname(uri);
  const tokenInfo = tokens[hostname];
  const allowUnsafeSSL = Boolean(
    getConfiguration('github', uri).allowUnsafeSSL
  );
  if (!tokenInfo) {
    throw new Error(`No token found for host ${hostname}`);
  }
  switch (tokenInfo.provider) {
    case 'github':
      return new GithubClient(
        protocol,
        hostname,
        tokenInfo.token,
        logger,
        allowUnsafeSSL
      );
    case 'gitlab':
      return new GitLabClient(
        protocol,
        hostname,
        tokenInfo.token,
        logger,
        allowUnsafeSSL
      );
    default:
      throw new Error(`Unknown git provider '${tokenInfo.provider}'`);
  }
}

export interface Client {
  name: string;

  test(): Promise<void>;

  getCurrentUser(): Promise<Response<User>>;

  getRepository(uri: vscode.Uri, rid: string): Promise<Response<Repository>>;

  getUserByUsername(username: string): Promise<Response<User>>;
}

export interface Response<T> {
  body: T;
}

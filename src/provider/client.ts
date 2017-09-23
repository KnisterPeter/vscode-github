import { getGitProtocol, getGitHostname } from '../git';
import { Tokens } from '../workflow-manager';
import { Repository } from './repository';

import { GithubClient } from './github/client';
import { GitLabClient } from './gitlab/client';

export async function createClient(cwd: string, tokens: Tokens): Promise<Client> {
  const protocol = await getGitProtocol(cwd);
  const hostname = await getGitHostname(cwd);
  const tokenInfo = tokens[hostname];
  switch (tokenInfo.provider) {
    case 'github':
      return new GithubClient(protocol, hostname, tokens[hostname].token);
    case 'gitlab':
      return new GitLabClient(protocol, hostname, tokens[hostname].token);
    default:
      throw new Error(`Unknown git provider '${tokenInfo.provider}'`);
  }
}

export interface Client {

  getRepository(rid: string): Promise<Response<Repository>>;

}

export interface Response<T> {
  body: T;
}

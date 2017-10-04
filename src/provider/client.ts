import { Git } from '../git';
import { Tokens } from '../workflow-manager';
import { Repository } from './repository';
import { User } from './user';

import { GithubClient } from './github/client';
import { GitLabClient } from './gitlab/client';

export async function createClient(git: Git, tokens: Tokens): Promise<Client> {
  const gitProtocol = await git.getGitProtocol();
  const protocol = gitProtocol.startsWith('http') ? gitProtocol : 'https:';
  const hostname = await git.getGitHostname();
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

  name: string;

  getRepository(rid: string): Promise<Response<Repository>>;

  getUserByUsername(username: string): Promise<Response<User>>;

}

export interface Response<T> {
  body: T;
}

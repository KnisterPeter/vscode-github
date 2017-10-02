import { Memento } from 'vscode';
import { Tokens } from './workflow-manager';

export function migrateToken(memento: Memento): void {
  const token = memento.get<string | undefined>('token');
  if (token) {
    const tokens = memento.get<Tokens>('tokens', {});
    tokens['github.com'] = {
      token,
      provider: 'github'
    };
    memento.update('tokens', tokens);
    memento.update(token, undefined);
  }
  let migrated = false;
  const tokens = memento.get<{[host: string]: string}>('tokens', {});
  const struct = Object.keys(tokens).reduce((akku: Tokens, host) => {
    if (typeof tokens[host] === 'string') {
      migrated = true;
      akku[host] = {
        token: tokens[host],
        provider: 'github'
      };
    } else {
      akku[host] = tokens[host] as any;
    }
    return akku;
  }, {});
  if (migrated) {
    memento.update('tokens', struct);
  }
}

export function listTokenHosts(memento: Memento): string[] {
  const tokens: Tokens | undefined = memento.get('tokens');
  if (!tokens) {
    return [];
  }
  return Object.keys(tokens);
}

export function removeToken(memento: Memento, host: string): void {
  const tokens: Tokens | undefined = memento.get('tokens');
  if (tokens) {
    delete tokens[host];
    memento.update('tokens', tokens);
  }
}

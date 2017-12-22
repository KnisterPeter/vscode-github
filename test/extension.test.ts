import * as assert from 'assert';

// you can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../src/extension';
import { Git } from '../src/git';
import * as tokens from '../src/tokens';

suite('vscode-github extension tests', () => {
  test('Extension should be active after startup', done => {
    setTimeout(() => {
      const extension = vscode.extensions.getExtension('KnisterPeter.vscode-github');
      assert.ok(extension);
      assert.equal(extension!.isActive, true);
      done();
    }, 1000 * 3);
  }).timeout(1000 * 10);

  test('should register commands', done => {
    vscode.commands.getCommands(true)
      .then(commands => commands.filter(command => command.startsWith('vscode-github')))
      .then(commands => {
        assert.equal(commands.length > 0, true);
      })
      .then(() => done());
  });

  test('should parse username and repository from github ssh url', () => {
    const git = new Git();
    const [proto, host, user, repo] = git.parseGitUrl('git@github:username/repo.git');
    assert.equal(proto, 'git:');
    assert.equal(host, 'github');
    assert.equal(user, 'username');
    assert.equal(repo, 'repo');
  });

  test('should parse username and repository from github ssh:// url', () => {
    const git = new Git();
    const [proto, host, user, repo] = git.parseGitUrl('git://github/username/repo.git');
    assert.equal(proto, 'git:');
    assert.equal(host, 'github');
    assert.equal(user, 'username');
    assert.equal(repo, 'repo');
  });

  test('should parse protocol from github http:// url', () => {
    const git = new Git();
    const [proto, host, user, repo] = git.parseGitUrl('http://my.github.com/username/repo.git');
    assert.equal(proto, 'http:');
    assert.equal(host, 'my.github.com');
    assert.equal(user, 'username');
    assert.equal(repo, 'repo');
  });

  test('should parse username and repository from github git@ url', () => {
    const git = new Git();
    const [proto, host, user, repo] = git.parseGitUrl('git@github.mycompany.io:org-name/repo-name.git');
    assert.equal(proto, 'git:');
    assert.equal(host, 'github.mycompany.io');
    assert.equal(user, 'org-name');
    assert.equal(repo, 'repo-name');
  });

  test('should migrate tokens to a provider structure', (done: MochaDone) => {
    tokens.migrateToken({
      get(name: string): any {
        if (name === 'tokens') {
          return {
            host: 'token'
          };
        }
        return undefined;
      },
      update(name: string, value: any): Thenable<void> {
        return Promise.resolve().then(() => {
          if (name === 'tokens') {
            assert.deepEqual(value, {
              host: {
                token: 'token',
                provider: 'github'
              }
            });
            done();
          }
        });
      }
    });
  });
});

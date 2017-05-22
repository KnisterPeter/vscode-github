import * as assert from 'assert';

// you can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../src/extension';
import * as git from '../src/git';

suite('vscode-github extension tests', () => {
  test('Extension should be active after startup', () => {
    const extension = vscode.extensions.getExtension('KnisterPeter.vscode-github');
    assert.ok(extension);
    assert.equal(extension!.isActive, true);
  });

  test('should register commands', done => {
    vscode.commands.getCommands(true)
      .then(commands => commands.filter(command => command.startsWith('vscode-github')))
      .then(commands => {
        assert.equal(commands.length > 0, true);
      })
      .then(() => done());
  });

  test('should parse username and repository from github ssh url', () => {
    const [host, user, repo] = git.parseGithubUrl('git@github:username/repo.git');
    assert.equal(host, 'github');
    assert.equal(user, 'username');
    assert.equal(repo, 'repo');
  });

  test('should parse username and repository from github ssh:// url', () => {
    const [host, user, repo] = git.parseGithubUrl('git://github/username/repo.git');
    assert.equal(host, 'github');
    assert.equal(user, 'username');
    assert.equal(repo, 'repo');
  });
});

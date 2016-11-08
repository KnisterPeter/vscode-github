'use strict';
import * as vscode from 'vscode';
import * as execa from 'execa';

import {getClient, GitHub, GitHubError, ListPullRequestsParameters, CreatePullRequestBody} from './github';

let github: GitHub;
let cwd: string;

export function activate(context: vscode.ExtensionContext): void {
  cwd = vscode.workspace.rootPath;
  getToken(context).then(token => {
    if (!github) {
      github = getClient(token);
    }
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.setGitHubToken',
      createGithubTokenCommand(context)));
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.createPullRequest',
      createPullRequest));
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.checkoutPullRequests',
      checkoutPullRequests));
}

function getToken(context: vscode.ExtensionContext): PromiseLike<string> {
  let token = context.globalState.get<string>('token');
  if (token) {
    return Promise.resolve(token);
  }
  return createGithubTokenCommand(context)().then(() => {
    return context.globalState.get<string>('token');
  });
}

function createGithubTokenCommand(context: vscode.ExtensionContext): () => PromiseLike<void> {
  return () => {
    const options = {
      ignoreFocusOut: true,
      password: true,
      placeHolder: 'GitHub Personal Access Token'
    };
    return vscode.window.showInputBox(options)
      .then(input => context.globalState.update('token', input))
      .then(() => getToken(context))
      .then(token => {
        github = getClient(token);
      });
  };
}

async function getGitHubOwnerAndRepository(): Promise<string[]> {
  return execa('git', ['config', '--get-regexp', 'remote\\.origin\\.url'], {cwd})
    .then(result => {
      const match = result.stdout.match(/^remote.origin.url git@github.com:(.*?)\/(.*?)(?:.git)?$/);
      if (!match) {
        throw new Error('Not a github project?');
      }
      return [match[1], match[2]];
    });
}

async function getCurrentBranch(): Promise<string|undefined> {
  return execa('git', ['status', '--porcelain', '--branch'], {cwd})
    .then(result => {
      const match = result.stdout.match(/^## (.+?)(?:\.\.\..*)?/);
      return match ? match[1] : undefined;
    });
}

async function getCommitMessage(): Promise<string> {
  return execa('git', ['log', '--oneline', '-1'], {cwd})
    .then(result => {
      const match = result.stdout.match(/^(?:.+?) (.*)/);
      return match ? match[1] : result.stdout;
    });
}

async function checkout(branch: string): Promise<void> {
  return execa('git', ['checkout', branch], {cwd})
    .then(() => undefined);
}

async function hasPullRequests(): Promise<boolean> {
  const [owner, repository] = await getGitHubOwnerAndRepository();
  const branch = await getCurrentBranch();
  const parameters: ListPullRequestsParameters = {
    state: 'open',
    head: `${owner}:${branch}`
  };
  const response = await github.listPullRequests(owner, repository, parameters);
  return response.body.length > 0;
}

async function createPullRequest(): Promise<void> {
  try {
    if (!await hasPullRequests()) {
      const [owner, repository] = await getGitHubOwnerAndRepository();
      const branch = await getCurrentBranch();
      console.log('orb', owner, repository, branch);
      const body: CreatePullRequestBody = {
        title: await getCommitMessage(),
        head: `${owner}:${branch}`,
        base: `master`
      };
      const result = await github.createPullRequest(owner, repository, body);
      console.log('result', result);
    }
  } catch (e) {
    console.log(e);
    if (e instanceof GitHubError) {
      console.error(e.response);
    }
    vscode.window.showErrorMessage('Some git error ' + e.message);
  }
}

async function checkoutPullRequests(): Promise<void> {
  try {
    const [owner, repository] = await getGitHubOwnerAndRepository();
    const parameters: ListPullRequestsParameters = {
      state: 'open'
    };
    const response = await github.listPullRequests(owner, repository, parameters);
    vscode.window.showQuickPick(response.body.map(pullRequest => ({
      label: pullRequest.title,
      description: `#${pullRequest.number}`,
      pullRequest
    }))).then(selected => {
      if (selected) {
        checkout(selected.pullRequest.head.ref);
      }
    });
  } catch (e) {
    console.log(e);
    if (e instanceof GitHubError) {
      console.error(e.response);
    }
    vscode.window.showErrorMessage('Some git error ' + e.message);
  }
}

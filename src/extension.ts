'use strict';
import * as vscode from 'vscode';

import * as git from './git';

import {getClient, GitHub, GitHubError, ListPullRequestsParameters, CreatePullRequestBody} from './github';

let cwd: string;
let token: string;
let github: GitHub;

export function activate(context: vscode.ExtensionContext): void {
  cwd = vscode.workspace.rootPath;
  getToken(context).then(_token => {
    token = _token;
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.setGitHubToken',
      createGithubTokenCommand(context)));
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.createPullRequest',
      wrapCommand(createPullRequest)));
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.checkoutPullRequests',
      wrapCommand(checkoutPullRequests)));
}

function wrapCommand<T>(command: T): T {
  const wrap: any = (...args: any[]) => {
    if (Boolean(token) && Boolean(cwd)) {
      return (command as any).apply(null, args);
    } else {
      vscode.window.showWarningMessage('Please setup your Github Personal Access Token '
        + 'and open a GitHub project in your workspace');
    }
  };
  return wrap;
}

function getToken(context: vscode.ExtensionContext): PromiseLike<string> {
  return Promise.resolve(context.globalState.get<string>('token'));
}

function getGitHubClient(): GitHub {
  if (!github) {
    github = getClient(token);
  }
  return github;
}

function createGithubTokenCommand(context: vscode.ExtensionContext): () => PromiseLike<void> {
  return () => {
    const options = {
      ignoreFocusOut: true,
      password: true,
      placeHolder: 'GitHub Personal Access Token'
    };
    return vscode.window.showInputBox(options)
      .then(input => {
        context.globalState.update('token', input);
        token = input;
      });
  };
}

async function hasPullRequestForCurrentBranch(): Promise<boolean> {
  const [owner, repository] = await git.getGitHubOwnerAndRepository(cwd);
  const branch = await git.getCurrentBranch(cwd);
  const parameters: ListPullRequestsParameters = {
    state: 'open',
    head: `${owner}:${branch}`
  };
  const response = await getGitHubClient().listPullRequests(owner, repository, parameters);
  return response.body.length > 0;
}

async function createPullRequest(): Promise<void> {
  try {
    if (!await hasPullRequestForCurrentBranch()) {
      const [owner, repository] = await git.getGitHubOwnerAndRepository(cwd);
      const branch = await git.getCurrentBranch(cwd);
      console.log('orb', owner, repository, branch);
      const body: CreatePullRequestBody = {
        title: await git.getCommitMessage(cwd),
        head: `${owner}:${branch}`,
        base: `master`
      };
      const result = await getGitHubClient().createPullRequest(owner, repository, body);
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
    const [owner, repository] = await git.getGitHubOwnerAndRepository(cwd);
    const parameters: ListPullRequestsParameters = {
      state: 'open'
    };
    const response = await getGitHubClient().listPullRequests(owner, repository, parameters);
    vscode.window.showQuickPick(response.body.map(pullRequest => ({
      label: pullRequest.title,
      description: `#${pullRequest.number}`,
      pullRequest
    }))).then(selected => {
      if (selected) {
        git.checkout(cwd, selected.pullRequest.head.ref);
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

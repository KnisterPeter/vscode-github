'use strict';
import * as vscode from 'vscode';
import {getClient, GitHub} from './github';

let github: GitHub;

export function activate(context: vscode.ExtensionContext): void {
  getToken(context).then(token => {
    github = getClient(token);
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.setGitHubToken',
      createGithubTokenCommand(context)));
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.listPullRequests',
      listPullRequests));
}

function getToken(context: vscode.ExtensionContext): PromiseLike<string> {
  let token = context.globalState.get<string>('token');
  if (token) {
    return Promise.resolve(token);
  }
  return createGithubTokenCommand(context)()
    .then(() => {
      return Promise.resolve(context.globalState.get<string>('token'));
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

async function listPullRequests(): Promise<void> {
  if (!github) {
    setTimeout(() => listPullRequests(), 1000);
    return;
  }
  try {
    const reponse = await github.listPullRequests('KnisterPeter', 'vscode-github');
    console.log('repos', reponse.body);
  } catch (err) {
    console.error(err);
    vscode.window.showErrorMessage('Failed to execute GitHub request');
  }
}

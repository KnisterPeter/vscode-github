import {join} from 'path';
import * as sander from 'sander';
import * as vscode from 'vscode';
import * as git from './git';
import {GitHubError, PullRequest, MergeMethod} from './github';
import {StatusBarManager} from './status-bar-manager';
import {GitHubManager} from './github-manager';

let cwd: string;
let channel: vscode.OutputChannel;
let githubManager: GitHubManager;
let statusBarManager: StatusBarManager;

export function activate(context: vscode.ExtensionContext): void {
  cwd = vscode.workspace.rootPath;

  channel = vscode.window.createOutputChannel('github');
  context.subscriptions.push(channel);
  channel.appendLine('Visual Studio Code GitHub Extension');

  githubManager = new GitHubManager(cwd, channel);
  statusBarManager = new StatusBarManager(context, githubManager);

  const token = context.globalState.get<string|undefined>('token');
  if (token) {
    githubManager.connect(token);
  }
  checkVersionAndToken(context, token);

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.setGitHubToken', createGithubTokenCommand(context)),
    vscode.commands.registerCommand('extension.createPullRequest', wrapCommand(createPullRequest)),
    vscode.commands.registerCommand('extension.checkoutPullRequests', wrapCommand(checkoutPullRequests)),
    vscode.commands.registerCommand('extension.browserPullRequest', wrapCommand(browserPullRequest)),
    vscode.commands.registerCommand('extension.mergePullRequest', wrapCommand(mergePullRequest))
  );
}

async function checkVersionAndToken(context: vscode.ExtensionContext, token: string|undefined): Promise<void> {
  const content = await sander.readFile(join(context.extensionPath, 'package.json'));
  const version = JSON.parse(content).version as string;
  const storedVersion = context.globalState.get<string|undefined>('version-test');
  if (version !== storedVersion && !Boolean(token)) {
    context.globalState.update('version-test', version);
    vscode.window.showInformationMessage(
      'To enable the Visual Studio Code GitHub Support, please set a Personal Access Token');
  }
}

function wrapCommand<T>(command: T): T {
  const wrap: any = (...args: any[]) => {
    if (githubManager.connected && cwd) {
      try {
        return (command as any).apply(null, args);
      } catch (e) {
        logAndShowError(e);
      }
    } else {
      vscode.window.showWarningMessage('Please setup your Github Personal Access Token '
        + 'and open a GitHub project in your workspace');
    }
  };
  return wrap;
}

function logAndShowError(e: Error): void {
    channel.appendLine(e.message);
    if (e instanceof GitHubError) {
      console.error(e.response);
      vscode.window.showErrorMessage('GitHub error: ' + e.message);
    } else {
      vscode.window.showErrorMessage('Error: ' + e.message);
    }
}

function createGithubTokenCommand(context: vscode.ExtensionContext): () => void {
  return async () => {
    const options = {
      ignoreFocusOut: true,
      password: true,
      placeHolder: 'GitHub Personal Access Token'
    };
    const input = await vscode.window.showInputBox(options);
    context.globalState.update('token', input);
    githubManager.connect(input);
  };
}

async function createPullRequest(): Promise<void> {
  const pullRequest = await githubManager.createPullRequest();
  if (pullRequest) {
    statusBarManager.updatePullRequestStatus();
    vscode.window.showInformationMessage(`Successfully created #${pullRequest.number}`);
  }
}

async function selectPullRequest(doSomething: (pullRequest: PullRequest) => void): Promise<void> {
  const pullRequests = await githubManager.listPullRequests();
  const items = pullRequests.map(pullRequest => ({
    label: pullRequest.title,
    description: `#${pullRequest.number}`,
    pullRequest
  }));
  const selected = await vscode.window.showQuickPick(items);
  if (selected) {
    doSomething(selected.pullRequest);
  }
}

async function checkoutPullRequests(): Promise<void> {
  selectPullRequest(async pullRequest => {
    await git.checkout(cwd, pullRequest.head.ref);
    statusBarManager.updatePullRequestStatus();
  });
}

async function browserPullRequest(): Promise<void> {
  selectPullRequest(pullRequest => {
    vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(pullRequest.html_url));
  });
}

type MergeOptionItems = { label: string; description: string; method: MergeMethod; };
async function mergePullRequest(): Promise<void> {
  const items: MergeOptionItems[] = [
    {
      label: 'Create merge commit',
      description: '',
      method: 'merge'
    },
    {
      label: 'Squash and merge',
      description: '',
      method: 'squash'
    },
    {
      label: 'Rebase and merge',
      description: '',
      method: 'rebase'
    }
  ];
  const selected = await vscode.window.showQuickPick(items);
  if (selected) {
    if (await githubManager.mergePullRequest(selected.method)) {
      statusBarManager.updatePullRequestStatus();
      vscode.window.showInformationMessage(`Successfully merged`);
    } else {
      vscode.window.showInformationMessage(`Merge failed for unknown reason`);
    }
  }
}

import {join} from 'path';
import * as sander from 'sander';
import * as vscode from 'vscode';
import * as git from './git';
import {getClient, GitHub, GitHubError, ListPullRequestsParameters, CreatePullRequestBody} from './github';

let cwd: string;
let storedToken: string;
let github: GitHub;
let channel: vscode.OutputChannel;
let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  checkVersionAndToken(context);

  cwd = vscode.workspace.rootPath;
  getToken(context)
    .then(_token => {
      storedToken = _token;
      refreshPullRequestStatus();
    });

  channel = vscode.window.createOutputChannel('github');
  context.subscriptions.push(channel);
  channel.appendLine('Visual Studio Code GitHub Extension');

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.setGitHubToken',
      createGithubTokenCommand(context)));
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.createPullRequest',
      wrapCommand(createPullRequest)));
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.checkoutPullRequests',
      wrapCommand(checkoutPullRequests)));
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.browserPullRequest',
      wrapCommand(browserPullRequest)));

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBar.command = '';
  statusBar.text = '$(git-pull-request)';
  statusBar.color = '#888';
  context.subscriptions.push(statusBar);
}

function checkVersionAndToken(context: vscode.ExtensionContext): void {
  sander.readFile(join(context.extensionPath, 'package.json'))
    .then(content => JSON.parse(content))
    .then(json => json.version as string)
    .then(version => {
      return getToken(context)
        .then(token => ({token, version}));
    })
    .then(({version, token}) => {
      const storedVersion = context.globalState.get('version-test');
      if (version !== storedVersion && !Boolean(token)) {
        context.globalState.update('version-test', version);
        vscode.window.showInformationMessage(
          'To enable the Visual Studio Code GitHub Support, please set a Personal Access Token');
      }
    });
}

async function refreshPullRequestStatus(): Promise<void> {
  if (storedToken) {
    await updatePullRequestStatus();
  }
  setTimeout(refreshPullRequestStatus, 5000);
}

async function updatePullRequestStatus(forceState?: boolean): Promise<void> {
  const hasPullRequest = await hasPullRequestForCurrentBranch();
  statusBar.show();
  if (forceState || hasPullRequest) {
    const status = await getCombinedStatusForPullRequest();
    switch (status) {
      case 'failure':
        statusBar.color = '#f00';
        break;
      case 'success':
        statusBar.color = '#0f0';
        break;
      default:
        statusBar.color = '#fff';
        break;
    }
    statusBar.tooltip = '';
    statusBar.command = '';
  } else {
    statusBar.color = '#888';
    statusBar.tooltip = 'Create pull-request for current branch';
    statusBar.command = 'extension.createPullRequest';
  }
}

function wrapCommand<T>(command: T): T {
  const wrap: any = (...args: any[]) => {
    if (Boolean(storedToken) && Boolean(cwd)) {
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
    github = getClient(storedToken);
  }
  return github;
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
        storedToken = input;
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
  return response.length > 0;
}

async function getCombinedStatusForPullRequest(): Promise<'failure' | 'pending' | 'success' |undefined> {
  const [owner, repository] = await git.getGitHubOwnerAndRepository(cwd);
  const branch = await git.getCurrentBranch(cwd);
  if (!branch) {
    return undefined;
  }
  const response = await getGitHubClient().getStatusForRef(owner, repository, branch);
  return response.state;
}

async function createPullRequest(): Promise<void> {
  try {
    if (!await hasPullRequestForCurrentBranch()) {
      const [owner, repository] = await git.getGitHubOwnerAndRepository(cwd);
      const branch = await git.getCurrentBranch(cwd);
      const body: CreatePullRequestBody = {
        title: await git.getCommitMessage(cwd),
        head: `${owner}:${branch}`,
        base: `master`
      };
      channel.appendLine('Create pull request:');
      channel.appendLine(JSON.stringify(body, undefined, ' '));
      const pullRequest = await getGitHubClient().createPullRequest(owner, repository, body);
      updatePullRequestStatus(true);
      vscode.window.showInformationMessage(`Successfully created #${pullRequest.number}`);
    }
  } catch (e) {
    logAndShowError(e);
  }
}

async function checkoutPullRequests(): Promise<void> {
  try {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(cwd);
    const parameters: ListPullRequestsParameters = {
      state: 'open'
    };
    const response = await getGitHubClient().listPullRequests(owner, repository, parameters);
    vscode.window.showQuickPick(response.map(pullRequest => ({
      label: pullRequest.title,
      description: `#${pullRequest.number}`,
      pullRequest
    }))).then(selected => {
      if (selected) {
        git.checkout(cwd, selected.pullRequest.head.ref);
      }
    });
  } catch (e) {
    logAndShowError(e);
  }
}

async function browserPullRequest(): Promise<void> {
  try {
    const [owner, repository] = await git.getGitHubOwnerAndRepository(cwd);
    const parameters: ListPullRequestsParameters = {
      state: 'open'
    };
    const response = await getGitHubClient().listPullRequests(owner, repository, parameters);
    vscode.window.showQuickPick(response.map(pullRequest => ({
      label: pullRequest.title,
      description: `#${pullRequest.number}`,
      pullRequest
    }))).then(selected => {
      if (selected) {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(selected.pullRequest.html_url));
      }
    });
  } catch (e) {
    logAndShowError(e);
  }
}

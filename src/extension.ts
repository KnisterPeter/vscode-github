'use strict';
import * as vscode from 'vscode';
import {Pretend, Get, Post} from 'pretend';

class GitHub {
    @Get('/user/repos')
    public async listRepositories(): Promise<GitHubResonse<Repository[]>> { return undefined; }

    @Post('/repos/{owner}/{repo}/pulls')
    public async createPullRequest(owner: string, repo: string, body: any) { return undefined; }
}

interface GitHubResonse<T> {
    headers: any;
    body: T;
}

interface Repository {
    id: number;
    owner: any;
    name: string;
    full_name: string;
    default_branch: string;
}

export function activate(context: vscode.ExtensionContext) {
    let token = context.globalState.get<string>('key');
    if (!token) {
        vscode.window.showInputBox({
            ignoreFocusOut: true,
            password: true,
            placeHolder: 'GitHub Personal Access Token'
        }).then(input => {
            context.globalState.update('key', input);
            token = input;
        });
    }
    const github = Pretend
        .builder()
        .requestInterceptor(request => {
            request.options.headers['Authorization'] = `token ${token}`;
            return request;
        })
        .decode(async response => {
            return {
                headers: response.headers,
                body: await response.json()
            };
        })
        .target(GitHub, 'https://api.github.com')

    let disposable = vscode.commands.registerCommand('extension.sayHello', async () => {
        vscode.window.showInformationMessage('Hello World!');
        console.log('request...');
        const reponse = await github.listRepositories();
        console.log('...done');
        console.log('repos', reponse.headers, reponse.body[0]);
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
}

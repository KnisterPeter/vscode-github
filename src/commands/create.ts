import { component } from 'tsdi';
import * as vscode from 'vscode';

import { TokenCommand } from '../command';
import { showProgress } from '../helper';

@component({eager: true})
export class CreateRepository extends TokenCommand {

  public id = 'vscode-github.createRepository';

  protected requireProjectFolder = false;

  @showProgress
  protected async runWithToken(): Promise<void> {
    const name = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: 'Name of the repository to create'
    });
    if (!name) {
      return;
    }
    const repository = await this.workflowManager.createRepository(this.uri, name);
    const action = await vscode.window.showInformationMessage(`Repository ${name} created`, 'Open');
    if (action === 'Open') {
      vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(repository.url));
    }
  }

}

import { TSDI, factory } from 'tsdi';
import * as vscode from 'vscode';

import { Extension } from './extension';

let tsdi: TSDI;

export function activate(context: vscode.ExtensionContext): void {
  class ComponentFactory {
    @factory({name: 'vscode.ExtensionContext'})
    public extensionContext(): vscode.ExtensionContext {
      return context;
    }
    @factory({name: 'vscode.WorkspaceFolder'})
    public workspaceFolder(): vscode.WorkspaceFolder {
      if (!vscode.workspace.workspaceFolders) {
        throw new Error('No vscode.workspace.workspaceFolders');
      }
      return vscode.workspace.workspaceFolders[0];
    }
    @factory({name: 'vscode.OutputChannel'})
    public outputChannel(): vscode.OutputChannel {
      const channel = vscode.window.createOutputChannel('GitHub');
      context.subscriptions.push(channel);
      return channel;
    }
  }
  tsdi = new TSDI();
  tsdi.enableComponentScanner();
  tsdi.register(ComponentFactory);
  context.subscriptions.push(tsdi.get(Extension));
}

export function deactivate(): void {
  tsdi.close();
}

import 'isomorphic-fetch';
import { TSDI, factory } from 'tsdi';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';

import { CommandManager } from './command-manager';
import { Extension } from './extension';

let tsdi: TSDI;

export function activate(context: vscode.ExtensionContext): void {
  class ComponentFactory {
    @factory({name: 'vscode.ExtensionContext'})
    public extensionContext(): vscode.ExtensionContext {
      return context;
    }
    @factory({name: 'vscode.OutputChannel'})
    public outputChannel(): vscode.OutputChannel {
      const channel = vscode.window.createOutputChannel('GitHub');
      context.subscriptions.push(channel);
      return channel;
    }
    @factory
    public telemetryReporter(): TelemetryReporter {
      const extensionId = 'vscode-github';
      const extensionVersion = vscode.extensions.getExtension('KnisterPeter.vscode-github')!.packageJSON.version;
      const key = '67a6da7f-d420-47bd-97d0-d1fd4b76ac55';
      const reporter = new TelemetryReporter(extensionId, extensionVersion, key);
      context.subscriptions.push(reporter);
      return reporter;
    }
  }
  tsdi = new TSDI();
  tsdi.enableComponentScanner();
  tsdi.register(ComponentFactory);
  // note: trigger CommandManager creating for now
  // this could be removed when tsdi is able to defer eager creation
  tsdi.get(CommandManager);
  context.subscriptions.push(tsdi.get(Extension));
}

export function deactivate(): void {
  tsdi.close();
}

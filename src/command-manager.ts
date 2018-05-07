import { TSDI, LifecycleListener, component, inject, initialize } from 'tsdi';
import * as vscode from 'vscode';

import { Command } from './command';
import './commands/browse';
import './commands/pull-requests';
import './commands/token';
import './commands/user';

@component
export class CommandManager implements LifecycleListener {

  @inject
  private readonly tsdi!: TSDI;

  @inject('vscode.ExtensionContext')
  private readonly context!: vscode.ExtensionContext;

  @initialize
  protected init(): void {
    this.tsdi.addLifecycleListener(this);
  }

  public onCreate(component: any): void {
    if (component instanceof Command) {
      this.context.subscriptions.push(
        vscode.commands.registerCommand(component.id, (...args: any[]) => component.run(...args))
      );
    }
  }

}

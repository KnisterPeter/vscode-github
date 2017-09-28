import * as vscode from 'vscode';

import { Configuration } from './configuration';

export function showProgress(_target: Object, _propertyKey: string | symbol,
    descriptor: PropertyDescriptor): PropertyDescriptor {
  const fn = descriptor.value;
  descriptor.value = function(): any {
    const options: vscode.ProgressOptions = {
      location: vscode.ProgressLocation.SourceControl,
      title: 'GitHub'
    };
    return vscode.window.withProgress(options, async(progress: any) => {
      return await fn.call(this, progress);
    });
  };
  return descriptor;
}

export function getConfiguration(): Configuration {
  const config = vscode.workspace.getConfiguration().get<Configuration>('github');
  if (!config) {
    throw new Error('Empty configuration. This is likely a bug.');
  }
  return config;
}

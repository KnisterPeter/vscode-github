import * as vscode from 'vscode';

import { Configuration, GitLabConfiguration } from './configuration';

export function showProgress(_target: Object, _propertyKey: string | symbol,
    descriptor: PropertyDescriptor): PropertyDescriptor {
  const fn = descriptor.value;
  descriptor.value = function(...args: any[]): any {
    const options: vscode.ProgressOptions = {
      location: vscode.ProgressLocation.SourceControl,
      title: 'GitHub'
    };
    return vscode.window.withProgress(options, async() => {
      return await fn.call(this, ...args);
    });
  };
  return descriptor;
}

export function getConfiguration(section: 'gitlab'): GitLabConfiguration;
export function getConfiguration(section?: 'github'): Configuration;
export function getConfiguration(section = 'github'): any {
  const config = vscode.workspace.getConfiguration().get<Configuration>(section);
  if (!config) {
    throw new Error('Empty configuration. This is likely a bug.');
  }
  return config;
}

export function getHostname(input: string): string {
  const match = input.match(/.*?(?::\/\/|@)([^:\/]+)/);
  if (match) {
    return match[1];
  }
  return input;
}

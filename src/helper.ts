import * as vscode from 'vscode';

import { Configuration, GitLabConfiguration } from './configuration';

export function showProgress(_target: object, _propertyKey: string | symbol,
    descriptor: PropertyDescriptor): PropertyDescriptor {
  const fn = descriptor.value;
  descriptor.value = async function(...args: any[]): Promise<any> {
    const options: vscode.ProgressOptions = {
      location: vscode.ProgressLocation.Window,
      title: 'GitHub'
    };
    return vscode.window.withProgress(options, async() => {
      return fn.call(this, ...args);
    });
  };
  return descriptor;
}

export function getConfiguration(section: 'github', uri: vscode.Uri): Configuration;
export function getConfiguration(section: 'gitlab', uri: vscode.Uri): GitLabConfiguration;
export function getConfiguration(section: string, uri: vscode.Uri): any {
  const config = vscode.workspace.getConfiguration(undefined, uri).get<Configuration>(section);
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

import * as vscode from 'vscode';

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

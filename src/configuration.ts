import { MergeMethod } from './provider/pull-request';

export interface Configuration {
  preferedMergeMethod?: MergeMethod;
  refreshPullRequestStatus: number;
  remoteName: string;
  upstream?: string;
  customPullRequestDescription: 'off' | 'singleLine' | 'gitEditor';
  statusBarCommand: string | null;
  statusbar: {
    refresh: number;
    command: string | null;
    color: boolean;
    successText?: string;
    pendingText?: string;
    failureText?: string;
  };
}

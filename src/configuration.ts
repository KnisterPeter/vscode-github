import { MergeMethod } from './provider/pull-request';

export interface Configuration {
  gitCommand?: string;
  preferedMergeMethod?: MergeMethod;
  refreshPullRequestStatus: number;
  remoteName: string;
  upstream?: string;
  customPullRequestTitle: boolean;
  customPullRequestDescription: 'off' | 'singleLine' | 'gitEditor';
  autoPublish?: boolean;
  allowUnsafeSSL?: boolean;
  statusBarCommand: string | null;
  statusbar: {
    enabled: boolean;
    refresh: number;
    command: string | null;
    color: boolean;
    successText?: string;
    pendingText?: string;
    failureText?: string;
  };
}

export interface GitLabConfiguration {
  removeSourceBranch?: boolean;
}

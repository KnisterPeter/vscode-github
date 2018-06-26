import * as vscode from 'vscode';
import { Response } from './client';
import { Issue } from './issue';
import { PullRequest } from './pull-request';
import { User } from './user';

export interface Repository {
  uri: vscode.Uri | undefined;
  name: string;
  defaultBranch: string;
  allowMergeCommits: boolean;
  allowSquashCommits: boolean;
  allowRebaseCommits: boolean;
  parent: Repository | undefined;
  url: string;
  cloneUrl: string;

  getPullRequests(
    parameters?: ListPullRequestsParameters
  ): Promise<Response<PullRequest[]>>;
  getPullRequest(id: number): Promise<Response<PullRequest>>;
  createPullRequest(
    body: CreatePullRequestBody
  ): Promise<Response<PullRequest>>;
  getIssues(parameters?: IssuesParameters): Promise<Response<Issue[]>>;
  getUsers(): Promise<Response<User[]>>;
}

export interface ListPullRequestsParameters {
  state?: 'open' | 'close' | 'all';
  sort?: 'created' | 'updated';
  direction?: 'asc' | 'desc';
}

export interface CreatePullRequestBody {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  body?: string;
}

export interface IssuesParameters {
  state?: 'closed' | 'all' | 'open';
  sort?: 'created' | 'updated';
  direction?: 'asc' | 'desc';
}

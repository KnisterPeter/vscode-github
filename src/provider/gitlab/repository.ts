import { Response } from '../client';
import { Issue } from '../issue';
import {
  Repository,
  ListPullRequestsParameters,
  CreatePullRequestBody,
  IssuesParameters
} from '../repository';
import { GitlabMergeRequest } from './merge-request';

export class GitlabRepository implements Repository {

  public name: string;
  public defaultBranch: string;
  public allowMergeCommits: boolean;
  public allowSquashCommits: boolean;
  public allowRebaseCommits: boolean;
  public parent: Repository | undefined;

  public async getPullRequests(_parameters?: ListPullRequestsParameters | undefined):
      Promise<Response<GitlabMergeRequest[]>> {
    throw new Error('Method not implemented.');
  }

  public async getPullRequest(_id: number): Promise<Response<GitlabMergeRequest>> {
    throw new Error('Method not implemented.');
  }

  public async createPullRequest(_body: CreatePullRequestBody): Promise<Response<GitlabMergeRequest>> {
    throw new Error('Method not implemented.');
  }

  public async getIssues(_parameters?: IssuesParameters | undefined): Promise<Response<Issue[]>> {
    throw new Error('Method not implemented.');
  }
}

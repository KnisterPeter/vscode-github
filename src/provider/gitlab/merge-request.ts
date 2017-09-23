import { Response } from '../client';
import {
  PullRequest,
  MergeBody,
  MergeResult,
  RequestReviewBody,
  CancelReviewBody,
  Comment
} from '../pull-request';
import { GitLab, MergeRequest } from './api';
import { GitLabRepository } from './repository';
import { GitLabUser } from './user';

export class GitLabMergeRequest implements PullRequest {

  private client: GitLab;
  private repository: GitLabRepository;
  private mergeRequest: MergeRequest;

  public get id(): number {
    return this.mergeRequest.id;
  }

  public get number(): number {
    return this.mergeRequest.iid;
  }

  public get state(): 'open' | 'closed' {
    switch (this.mergeRequest.state) {
      case 'opened':
        return 'open';
      case 'closed':
      case 'merged':
        return 'closed';
    }
  }

  public get title(): string {
    return this.mergeRequest.title;
  }

  public get body(): string {
    return this.mergeRequest.description;
  }

  public get url(): string {
    return this.mergeRequest.web_url;
  }

  public get sourceBranch(): string {
    return this.mergeRequest.source_branch;
  }

  public get targetBranch(): string {
    return this.mergeRequest.target_branch;
  }

  public get mergeable(): boolean {
    switch (this.mergeRequest.merge_status) {
      case 'can_be_merged':
        return true;
    }
  }

  constructor(client: GitLab, repository: GitLabRepository, mergeRequest: MergeRequest) {
    this.client = client;
    this.repository = repository;
    this.mergeRequest = mergeRequest;
  }

  public async getComments(): Promise<Response<Comment[]>> {
    throw new Error('Method not implemented.');
  }

  public async merge(_body: MergeBody): Promise<Response<MergeResult>> {
    throw new Error('Method not implemented.');
  }

  public async assign(_assignees: GitLabUser[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async unassign(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async requestReview(_body: RequestReviewBody): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async cancelReview(_body: CancelReviewBody): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

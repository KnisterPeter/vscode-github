import { getConfiguration } from '../../helper';
import { Response } from '../client';
import {
  PullRequest,
  MergeBody,
  MergeResult,
  RequestReviewBody,
  CancelReviewBody,
  Comment,
  UpdateBody
} from '../pull-request';
import { GitLab, MergeRequest, UpdateMergeRequestBody } from './api';
import { GitLabRepository } from './repository';
import { GitLabUser } from './user';

export class GitLabMergeRequest implements PullRequest {

  private readonly client: GitLab;
  private readonly repository: GitLabRepository;
  private readonly mergeRequest: MergeRequest;

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

  public async update(body: UpdateBody): Promise<void> {
    const gitlabBody: UpdateMergeRequestBody = {};
    if (body.title) {
      gitlabBody.title = body.title;
    }
    if (body.body) {
      gitlabBody.description = body.body;
    }
    if (body.state) {
      const mapState = (state: UpdateBody['state']): UpdateMergeRequestBody['state_event'] => {
        switch (state) {
          case 'open':
            return 'reopen';
          case 'closed':
            return 'close';
          default:
            return undefined;
          }
      };
      gitlabBody.state_event = mapState(body.state);
    }
    await this.client.updateMergeRequest(
      encodeURIComponent(this.repository.pathWithNamespace),
      this.mergeRequest.iid,
      gitlabBody
    );
  }

  public async getComments(): Promise<Response<Comment[]>> {
    throw new Error('Method not implemented.');
  }

  public async merge(_body: MergeBody): Promise<Response<MergeResult>> {
    const removeSourceBranch = this.repository.uri
      ? getConfiguration('gitlab', this.repository.uri).removeSourceBranch
      : false;
    const response = await this.client.acceptMergeRequest(
      encodeURIComponent(this.repository.pathWithNamespace),
      this.mergeRequest.iid,
      {
        should_remove_source_branch: removeSourceBranch
      }
    );
    return {
      body: {
        message: response.body.title,
        merged: response.body.state === 'merged',
        sha: response.body.sha
      }
    };
  }

  public async assign(assignees: GitLabUser[]): Promise<void> {
    await this.client.updateMergeRequest(
      encodeURIComponent(this.repository.pathWithNamespace),
      this.mergeRequest.iid,
      {
        assignee_id: assignees[0].id
      }
    );
  }

  public async unassign(): Promise<void> {
    // note: assign to '0'
    await this.client.updateMergeRequest(
      encodeURIComponent(this.repository.pathWithNamespace),
      this.mergeRequest.iid,
      {
        assignee_id: 0
      }
    );
  }

  public async requestReview(_body: RequestReviewBody): Promise<void> {
    throw new Error('Method not implemented.');
  }

  public async cancelReview(_body: CancelReviewBody): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

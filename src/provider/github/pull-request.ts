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
import { GitHub, PullRequestStruct } from './api';
import { GithubRepository } from './repository';
import { GithubUser } from './user';

export class GithubPullRequest implements PullRequest {

  private readonly client: GitHub;
  private readonly repository: GithubRepository;
  private readonly struct: PullRequestStruct;

  get id(): number {
    return this.struct.id;
  }

  get number(): number {
    return this.struct.number;
  }

  get state(): 'open' | 'closed' {
    return this.struct.state;
  }

  get title(): string {
    return this.struct.title;
  }

  get body(): string {
    return this.struct.body;
  }

  get url(): string {
    return this.struct.html_url;
  }

  get sourceBranch(): string {
    return this.struct.head.ref;
  }

  get targetBranch(): string {
    return this.struct.base.ref;
  }

  get mergeable(): boolean | null | undefined {
    return this.struct.mergeable;
  }

  constructor(client: GitHub, repository: GithubRepository, struct: PullRequestStruct) {
    this.client = client;
    this.repository = repository;
    this.struct = struct;
  }

  public async update(body: UpdateBody): Promise<void> {
    await this.client.updatePullRequest(
      this.repository.owner,
      this.repository.repository,
      this.number,
      {
        title: body.title,
        body: body.body,
        state: body.state
      }
    );
  }

  public async getComments(): Promise<Response<Comment[]>> {
    const response = await this.client.getPullRequestComments(
      this.repository.owner,
      this.repository.repository,
      this.number
    );
    return {
      body: response.body.map(comment => {
        return {
          file: comment.path,
          line: comment.position,
          body: comment.body
        };
      })
    };
  }

  public async merge(body: MergeBody): Promise<Response<MergeResult>> {
    const response = await this.client.mergePullRequest(
      this.repository.owner,
      this.repository.repository,
      this.number,
      {
        merge_method: body.mergeMethod
      }
    );
    return {
      body: {
        merged: response.body.merged,
        message: response.body.message,
        sha: response.body.sha
      }
    };
  }

  public async assign(assignees: GithubUser[]): Promise<void> {
    await this.client.editIssue(
      this.repository.owner,
      this.repository.repository,
      this.number,
      {
        assignees: assignees.map(assignee => assignee.username)
      }
    );
  }

  public async unassign(): Promise<void> {
    await this.client.editIssue(
      this.repository.owner,
      this.repository.repository,
      this.number,
      {
        assignees: []
      }
    );
  }

  public async requestReview(body: RequestReviewBody): Promise<void> {
    await this.client.requestReview(
      this.repository.owner,
      this.repository.repository,
      this.number,
      {
        reviewers: body.reviewers
      }
    );
  }

  public async cancelReview(body: CancelReviewBody): Promise<void> {
    await this.client.deleteReviewRequest(
      this.repository.owner,
      this.repository.repository,
      this.number,
      {
        reviewers: body.reviewers
      }
    );
  }
}

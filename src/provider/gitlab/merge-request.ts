import { Response } from '../client';
import {
  PullRequest,
  MergeBody,
  MergeResult,
  RequestReviewBody,
  CancelReviewBody,
  Comment
} from '../pull-request';
import { GitLabUser } from './user';

export class GitLabMergeRequest implements PullRequest {

  public id: number;
  public number: number;
  public state: 'open' | 'closed';
  public title: string;
  public body: string;
  public url: string;
  public sourceBranch: string;
  public targetBranch: string;
  public mergeable?: boolean | null | undefined;

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

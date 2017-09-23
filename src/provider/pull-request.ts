import { Response } from './client';
import { User } from './user';

export interface PullRequest {
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string;
  url: string;
  sourceBranch: string;
  targetBranch: string;
  mergeable?: boolean|null;

  getComments(): Promise<Response<Comment[]>>;
  merge(body: MergeBody): Promise<Response<MergeResult>>;
  assign(assignees: User<any>[]): Promise<void>;
  unassign(): Promise<void>;
  requestReview(body: RequestReviewBody): Promise<void>;
  cancelReview(body: CancelReviewBody): Promise<void>;
}

export interface MergeBody {
  mergeMethod: MergeMethod;
}

export type MergeMethod = 'merge' | 'squash' | 'rebase';

export interface MergeResult {
  sha?: string;
  merged?: boolean;
  message: string;
}

export interface RequestReviewBody {
  reviewers: string[];
}

export interface CancelReviewBody {
  reviewers: string[];
}

export interface Comment {
  file: string;
  line: number;
  body: string;
}

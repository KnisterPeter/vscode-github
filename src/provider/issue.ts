import { Response } from './client';
import { User } from './user';

export interface Issue {
  number: number;
  title: string;
  url: string;
  body: string;

  comments(): Promise<Response<IssueComment[]>>;
}

export interface IssueComment {
  user: User;
  body: string;
}

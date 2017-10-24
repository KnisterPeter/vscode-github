import { Response } from '../client';
import { Issue, IssueComment } from '../issue';
import { GitHub, Issue as IssueStruct } from './api';
import { GithubRepository } from './repository';
import { GithubUser } from './user';

export class GithubIssue implements Issue {

  private client: GitHub;
  private repository: GithubRepository;
  private struct: IssueStruct;

  public get number(): number {
    return this.struct.number;
  }

  public get title(): string {
    return this.struct.title;
  }

  public get url(): string {
    return this.struct.html_url;
  }

  public get body(): string {
    return this.struct.body;
  }

  constructor(client: GitHub, repository: GithubRepository, struct: IssueStruct) {
    this.client = client;
    this.repository = repository;
    this.struct = struct;
  }

  public async comments(): Promise<Response<IssueComment[]>> {
    const response = await this.client.getIssueComments(
      this.repository.owner,
      this.repository.repository,
      this.number
    );
    return {
      body: response.body.map(comment => ({
        body: comment.body,
        user: new GithubUser(this.client, comment.user)
      }))
    };
  }
}

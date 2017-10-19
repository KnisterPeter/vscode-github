import { Response } from '../client';
import { Issue, IssueComment } from '../issue';
import { GitLab, Issue as IssueStruct } from './api';
import { GitLabRepository } from './repository';
import { GitLabUser } from './user';

export class GitLabIssue implements Issue {

  private client: GitLab;
  private repository: GitLabRepository;
  private struct: IssueStruct;

  public get number(): number {
    return this.struct.iid;
  }

  public get title(): string {
    return this.struct.title;
  }

  public get url(): string {
    return this.struct.web_url;
  }

  public get body(): string {
    return this.struct.description;
  }

  constructor(client: GitLab, repository: GitLabRepository, struct: IssueStruct) {
    this.client = client;
    this.repository = repository;
    this.struct = struct;
  }

  public async comments(): Promise<Response<IssueComment[]>> {
    const response = await this.client.getIssueNotes(
      encodeURIComponent(this.repository.pathWithNamespace),
      this.number
    );
    return {
      body: response.body.map(note => ({
        body: note.body,
        user: new GitLabUser(this.client, note.author)
      }))
    };
  }
}

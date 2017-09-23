import { User } from '../user';

export class GitLabUser implements User<number> {
  public id: number;
}

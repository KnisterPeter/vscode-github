import { User } from '../user';

export class GitlabUser implements User<number> {
  public id: number;
}

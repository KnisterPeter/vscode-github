import { Repository } from './repository';

export interface Client {

  getRepository(rid: string): Promise<Response<Repository>>;

}

export interface Response<T> {
  body: T;
}

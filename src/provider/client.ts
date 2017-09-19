import { Repository } from './repository';

export interface Client {
  getRepository(id: string): Promise<Response<Repository>>;
}

export interface Response<T> {
  body: T;
}

declare module 'sander' {
  export function readFile(path: string): Promise<Buffer>;
  export function unlink(path: string): Promise<undefined>;
}

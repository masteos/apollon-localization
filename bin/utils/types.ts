import { Arguments } from 'yargs';

export type Args = Arguments<{
  file: string;
  target?: string;
}>;

export interface Dict {
  [key: string]: string | Dict;
}

export interface ReplacementDict {
  [key: string]: [RegExp | string, string];
}

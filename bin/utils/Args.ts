import { Arguments } from 'yargs';

export type Args = Arguments<{
  file: string;
  target?: string;
}>;

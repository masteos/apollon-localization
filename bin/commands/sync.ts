import { CommandModule } from 'yargs';

import path from 'path';
import fs from 'fs/promises';

import { print, PrintLoading } from '../print';
import { Args } from './arguments';

const langFolder = path.join(process.cwd(), 'langs');
const lib = path.join(process.cwd(), '/lib/index.ts');

export const sync: CommandModule<Record<string, unknown>, Args> = {
  command: 'sync',
  describe: 'Sync localization file to the lib',
  handler: async args => {
    let task: PrintLoading | undefined;

    task = print('Fetching languages', { loading: true });

    const files = (await fs.readdir(langFolder)).filter(name => name.endsWith('.json'));

    task.succeed();

    task = print('Updating lib', { loading: true });

    const libScript = files
      .map(
        name =>
          `export { default as ${path
            .basename(name, '.json')
            .replace('-', '')} } from '../langs/${name}';`
      )
      .join('\n');

    await fs.writeFile(lib, libScript + '\n', {
      encoding: 'utf-8',
    });

    task.succeed();
    process.exit(0);
  },
};

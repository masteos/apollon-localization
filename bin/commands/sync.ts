import { CommandModule } from 'yargs';

import path from 'path';
import fs from 'fs/promises';

import { print, Args } from '../utils';

const langFolder = path.join(process.cwd(), 'langs');
const lib = path.join(process.cwd(), '/lib/index.ts');

export const sync: CommandModule<Record<string, unknown>, Args> = {
  command: 'sync',
  describe: 'Sync localization file to the lib',
  handler: async args => {
    let task;

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
    const disclamerComment =
      '/*\n * This file is auto-generated using the sync command.\n * Do not edit directly.\n */\n\n';

    await fs.writeFile(lib, disclamerComment + libScript + '\n', {
      encoding: 'utf-8',
    });

    task.succeed();
    process.exit(0);
  },
};

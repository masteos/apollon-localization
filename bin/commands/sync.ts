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

    // const files = (await fs.readdir(langFolder)).filter(name => name.endsWith('.json'));

    const getFiles = async (folderPath: string): Promise<Record<string, string[]>> => {
      const dirents = await fs.readdir(folderPath, { withFileTypes: true });
      const files = await Promise.all(
        dirents.map(dirent => {
          const subPath = path.join(folderPath, dirent.name);
          return dirent.isDirectory() ? getFiles(subPath) : subPath;
        })
      );

      const fileStruct = files.reduce<Record<string, string[]>>(
        (acc, item) => {
          if (Array.isArray(item)) {
            console.log(item[0]);
            
            const key = path.dirname(item[0]).split('/').pop() as string;
            acc[key] = item;
          } else {
            acc.root.push(item as string);
          }

          return acc;
        },
        { root: [] }
      );

      return fileStruct;
      // return Array.prototype.concat(...files);
    };

    console.log(await getFiles(langFolder));

    return;

    const files = [];
    // const files = (await getFiles(langFolder)).reduce<string[]>((acc, name) => {
    //   if (name.endsWith('.json')) {
    //     acc.push(name.replace(langFolder + '/', ''));
    //   }

    //   return acc;
    // }, []);

    console.log(files);
    task.succeed();

    task = print('Updating lib', { loading: true });

    const libScript = files
      .map(
        name =>
          `export { default as ${name
            .replace(/\.json$/, '')
            .replace(/_/g, '')
            .replace(/\//g, '_')} } from '../langs/${name}';`
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

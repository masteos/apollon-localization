import { CommandModule } from 'yargs';

import path from 'path';
import fs from 'fs/promises';

import { print, Args } from '../utils';

const langFolder = path.join(process.cwd(), 'langs/');
const lib = path.join(process.cwd(), '/lib/index.ts');

const formatFileName = (name: string) =>
  name
    .replace(/\.json$/, '')
    .replace(/_/g, '')
    .replace(/\//g, '_');

const getFiles = async (folderPath: string): Promise<string[]> => {
  const dirents = await fs.readdir(folderPath, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map(dirent => {
      const subPath = path.join(folderPath, dirent.name);
      return dirent.isDirectory() ? getFiles(subPath) : subPath;
    })
  );

  return Array.prototype.concat(...files);
};

const groupByFolders = (files: string[], basePath: string) =>
  files.reduce<Record<string, string[]>>(
    (acc, item) => {
      const relativePath = item.replace(basePath, '');
      const dirname = path.dirname(relativePath);

      if (dirname === '.') {
        acc.root.push(item);
      } else {
        if (acc[dirname] === undefined) {
          acc[dirname] = [];
        }

        acc[dirname].push(item.replace(dirname + '/', ''));
      }

      return acc;
    },
    { root: [] }
  );

const importFolderFiles = (folder: string, files: string[]) => {
  switch (folder) {
    case 'root':
      return files
        .map(name => `export const ${formatFileName(name)} = require('../langs/${name}');`)
        .join('\n');

    default:
      return `export const ${folder} = {\n${files
        .map(name => `  ${formatFileName(name)}: require('../langs/${folder}/${name}'),`)
        .join('\n')}\n};`;
  }
};

export const sync: CommandModule<Record<string, unknown>, Args> = {
  command: 'sync',
  describe: 'Sync localization file to the lib',
  handler: async args => {
    let task;

    task = print('Fetching languages', { loading: true });

    // const files = (await fs.readdir(langFolder)).filter(name => name.endsWith('.json'));

    const files = (await getFiles(langFolder)).reduce<string[]>((acc, name) => {
      if (name.endsWith('.json')) {
        acc.push(name.replace(langFolder, ''));
      }

      return acc;
    }, []);

    const filesGrouped = groupByFolders(files, langFolder);

    task.succeed();

    task = print('Updating lib', { loading: true });

    const libScript = Object.entries(filesGrouped)
      .map(([folder, files]) => importFolderFiles(folder, files))
      .join('\n\n');
    const disclamerComment =
      '/*\n * This file is auto-generated using the sync command.\n * Do not edit directly.\n */\n\n';

    await fs.writeFile(lib, disclamerComment + libScript + '\n', {
      encoding: 'utf-8',
    });

    task.succeed();
    process.exit(0);
  },
};

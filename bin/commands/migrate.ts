import { CommandModule } from 'yargs';
import { transformNamespace } from 'i18next-v4-format-converter';

import path from 'path';
import fs from 'fs/promises';

import { print, Args } from '../utils';

const langFolder = path.join(process.cwd(), 'langs');

const convertFileToV4 = async (file: string) => {
  const filePath = path.join(langFolder, file);
  const fileContent = JSON.parse(await fs.readFile(filePath, { encoding: 'utf-8' }));
  const migratedContent = transformNamespace(file.replace('.json', ''), fileContent);

  await fs.writeFile(filePath, JSON.stringify(migratedContent, null, 2) + '\n', {
    encoding: 'utf-8',
  });
};

export const migrate: CommandModule<Record<string, unknown>, Args> = {
  command: 'migrate',
  describe: 'Migrate to i18next V4 JSON format',
  handler: async args => {
    let task;

    task = print('Fetching languages', { loading: true });

    const files = (await fs.readdir(langFolder)).filter(name => name.endsWith('.json'));

    task.succeed();

    task = print('Converting languages', { loading: true });

    await Promise.all(files.map(convertFileToV4));

    task.succeed();
    process.exit(0);
  },
};

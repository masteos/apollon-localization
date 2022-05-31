import { CommandModule } from 'yargs';

import path from 'path';
import fs from 'fs/promises';

import { print, Args, ReplacementDict, Dict } from '../utils';

const langFolder = path.join(process.cwd(), 'langs');
const replacements: ReplacementDict = {
  spaceBeforeLineBreak: [/ +\n/, '\n'],
  spaceInPlaceholder: [/\{\{ +(\w+) +\}\}/, '{{$1}}'],
};
let changedKeys = 0;

const formatKey = (key: string, value: string) => {
  let formated = value;

  Object.values(replacements).forEach(([search, replace]) => {
    formated = formated.replace(search, replace);
  });

  if (formated !== value) {
    changedKeys += 1;
  }

  return [key, formated];
};

const formatDict = (dict: Dict): Dict =>
  Object.fromEntries(
    Object.entries(dict).map(([key, value]) => {
      if (typeof value === 'object') {
        return [key, formatDict(value)];
      }

      return formatKey(key, value);
    })
  );
const sortDict = (dict: Dict): Dict =>
  Object.keys(dict)
    .sort()
    .reduce(
      (acc, key) => ({
        ...acc,
        [key]: typeof dict[key] === 'object' ? sortDict(dict[key] as Dict) : dict[key],
      }),
      {}
    );

const formatFile = async (file: string) => {
  const filePath = path.join(langFolder, file);
  const fileContent = JSON.parse(await fs.readFile(filePath, { encoding: 'utf-8' }));

  let formatedContent = formatDict(fileContent);
  formatedContent = sortDict(fileContent);

  await fs.writeFile(filePath, JSON.stringify(formatedContent, null, 2) + '\n', {
    encoding: 'utf-8',
  });
};

export const format: CommandModule<Record<string, unknown>, Args> = {
  aliases: ['fmt'],
  command: 'format',
  describe: 'Format files',
  handler: async args => {
    let task;

    task = print('Fetching languages', { loading: true });

    const files = (await fs.readdir(langFolder)).filter(name => name.endsWith('.json'));

    task.succeed();

    task = print('Formating languages', { loading: true });

    await Promise.all(files.map(formatFile));
    print(`${changedKeys} keys formatted`, {});

    task.succeed();
    process.exit(0);
  },
};

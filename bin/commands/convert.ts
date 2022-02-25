import { gettextToI18next, i18nextToPo } from 'i18next-conv';
import { Argv, CommandModule } from 'yargs';

import path from 'path';
import fs from 'fs';

import { print, PrintFormats, Args } from '../utils';

export const convert: CommandModule<Record<string, unknown>, Args> = {
  builder: args =>
    args
      .positional('file', {
        alias: 'f',
        describe: 'file to convert',
        normalize: true,
        type: 'string',
      })
      .positional('target', {
        alias: 't',
        describe: 'path to save to',
        normalize: true,
        type: 'string',
      }) as Argv<Args>,
  command: 'convert <file> [target]',
  describe: 'convert a file to .po or .json',
  handler: async args => {
    if (!fs.existsSync(args.file)) {
      print('File not found', {
        format: PrintFormats.error,
      });
      process.exit(1);
    }

    const pathMeta = path.parse(args.file);
    const task = print(`Converting ${args.file}...`, {
      loading: true,
    });
    let data, target;

    switch (pathMeta.ext) {
      case '.po':
        data = await gettextToI18next(
          pathMeta.name,
          fs.readFileSync(args.file, { encoding: 'utf-8' })
        );
        target = args.target || args.file.replace(pathMeta.ext, '.json');
        break;
      case '.json':
        data = await i18nextToPo(pathMeta.name, fs.readFileSync(args.file, { encoding: 'utf-8' }));
        target = args.target || args.file.replace(pathMeta.ext, '.po');
        break;
      default:
        console.error('File type not supported (support .po and .json)');
        process.exit(1);
    }

    fs.writeFileSync(target, data, { encoding: 'utf-8' });
    task.succeed(`Saved to ${target}`);
    process.exit(0);
  },
};

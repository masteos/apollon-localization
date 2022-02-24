#!/usr/bin/env ts-node
import Yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import * as commands from './commands';
const yargs = Yargs(hideBin(process.argv))
  .version('v', 'Show version number', '1.0.0')
  .help('h')
  .alias('v', 'version')
  .alias('h', 'help')
  .recommendCommands()
  .demandCommand(1);

Object.values(commands).forEach(command => yargs.command(command));

yargs.parse();

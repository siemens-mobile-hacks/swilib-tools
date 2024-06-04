#!/usr/bin/env node
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import process from "node:process";
import { updateCacheCmd } from '../src/cli/updateCache.js';
import { checkSwilibCmd } from '../src/cli/checkSwilib.js';
import { serverCmd } from '../src/cli/server.js';
import { checkGitRepos } from '../src/utils.js';

await yargs(hideBin(process.argv))
	.command('check <phone> [file]', 'Check swilib.vkp for errors.', (yargs) => {
		return yargs
			.positional('phone', { describe: 'Phone model with sw version (e.g. EL71v45) or platform (ELKA|NSG|X75|SG).' })
			.positional('file', { describe: 'The swilib.vkp that will be checked for errors.' });
	}, (argv) => {
		if (checkGitRepos())
			checkSwilibCmd(argv);
	})
	.command('update-cache', 'Update all caches (for server).', () => {}, async (argv) => {
		if (checkGitRepos())
			await updateCacheCmd(argv);
	})
	.command('server [port]', 'Run backend for web-dev-tools.', (yargs) => {
		return yargs
			.positional('port', { describe: 'Server port.', default: 4000 });
	}, (argv) => {
		if (checkGitRepos())
			serverCmd(argv);
	})
	.help()
	.showHelpOnFail(true)
	.wrap(null)
	.parse();

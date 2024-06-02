#!/usr/bin/env node
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import process from "node:process";
import { updateCacheCmd } from '../src/cli/updateCache.js';
import { checkSwilibCmd } from '../src/cli/checkSwilib.js';

await yargs(hideBin(process.argv))
	.command('update-cache', 'Update all caches.', () => {}, async (argv) => {
		await updateCacheCmd(argv);
	})
	.command('check <platform> <file>', 'Check swilib.vkp for errors.', (yargs) => {
		return yargs
			.positional('platform', { describe: 'ELKA|NSG|X75|SG' })
			.positional('file', { describe: 'The swilib.vkp that will be checked for errors.' });
	}, (argv) => {
		checkSwilibCmd(argv);
	})
	.parse();

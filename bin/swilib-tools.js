#!/usr/bin/env node
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import process from "node:process";
import { updateCacheCmd } from '../src/cli/updateCache.js';
import { checkSwilibCmd } from '../src/cli/checkSwilib.js';
import { mergeSwilib } from '../src/cli/mergeSwilib.js';
import { serverCmd } from '../src/cli/server.js';
import { checkGitRepos } from '../src/utils.js';
import { genSymbols } from '../src/cli/genSymbols.js';

await yargs(hideBin(process.argv))
	.command('check <phone> [file]', 'Check swilib.vkp for errors.', (yargs) => {
		return yargs
			.positional('phone', { describe: 'Phone model with sw version (e.g. EL71v45) or platform (ELKA|NSG|X75|SG).' })
			.positional('file', { describe: 'The swilib.vkp that will be checked for errors.' });
	}, (argv) => {
		if (checkGitRepos())
			checkSwilibCmd(argv);
	})
	.command('merge <phone> <file_a> <file_b> <new_file>', 'Merge two swilib\'s into single one.', (yargs) => {
		return yargs
			.positional('phone', { describe: 'Phone model with sw version (e.g. EL71v45) or platform (ELKA|NSG|X75|SG).' })
			.positional('file_a', { describe: 'The first swilib.vkp to merge.' })
			.positional('file_b', { describe: 'The second swilib.vkp to merge.' })
			.positional('new_file', { describe: 'Merged swilib.vkp.' });
	}, (argv) => {
		if (checkGitRepos())
			mergeSwilib(argv);
	})
	.command('gen-symbols <phone> [file]', 'Generate symbols for disassembler.', (yargs) => {
		return yargs
			.positional('phone', { describe: 'Phone model with sw version (e.g. EL71v45) or platform (ELKA|NSG|X75|SG' })
			.positional('file', { describe: 'The swilib.vkp that will be checked for errors.' })
			.option('format', { describe: 'Symbols format: ida|ghidra', default: 'ghidra' });
	}, async (argv) => {
		if (checkGitRepos())
			await genSymbols(argv);
	})
	.command('server [port]', 'Run backend for web-dev-tools.', (yargs) => {
		return yargs
			.positional('port', { describe: 'Server port.', default: 31000 });
	}, (argv) => {
		if (checkGitRepos())
			serverCmd(argv);
	})
	.command('update-cache', 'Update all caches (for server).', () => {}, async (argv) => {
		if (checkGitRepos())
			await updateCacheCmd(argv);
	})
	.alias('h', 'help')
	.usage('$0 <command> [options]')
	.command('$0', 'Swilib tools.', () => { }, (argv) => console.log(`Specify --help for available options.`))
	.showHelpOnFail(true)
	.help('help')
	.wrap(null)
	.parse();

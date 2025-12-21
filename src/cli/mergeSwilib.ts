import fs from 'fs';
import chalk from 'chalk';
import * as inquirer from '@inquirer/prompts';
import { table as asciiTable } from 'table';
import { SDK_DIR } from '../utils.js';
import { sprintf } from 'sprintf-js';
import { CLIBaseOptions } from "#src/cli.js";
import { createAppCommand } from "#src/utils/command.js";
import {
	analyzeSwilib,
	getSwilibPlatform,
	loadSwilibConfig,
	parseLibraryFromSDK,
	parseSwilibPatch,
	serializeSwilib,
	Swilib,
	SwilibAnalysisResult
} from "@sie-js/swilib";

interface Options extends CLIBaseOptions {
	target: string;
	source: string;
	destination: string;
	output: string;
}

export default createAppCommand<Options>(async ({ source, destination, target, output }) => {
	const swilibConfig = loadSwilibConfig(SDK_DIR);
	const platform = getSwilibPlatform(swilibConfig, target);
	const sdklib = await parseLibraryFromSDK(SDK_DIR, platform);

	let maxFunctionId = 0;
	const swilibs: Swilib[] = [];
	const analysis: SwilibAnalysisResult[] = [];
	for (const file of [source, destination]) {
		const swilib = parseSwilibPatch(swilibConfig, fs.readFileSync(file), { target });
		swilib.entries[sdklib.entries.length - 1] = swilib.entries[sdklib.entries.length - 1] || undefined;
		swilibs.push(swilib);
		analysis.push(analyzeSwilib(swilibConfig, swilib, sdklib));
		maxFunctionId = Math.max(swilib.entries.length, maxFunctionId);
	}

	if (swilibs[0].offset != swilibs[1].offset) {
		console.error(chalk.red(`Swilib's have different base offsets, merge is not possible.`));
		return;
	}

	const answers = new Map<number, number>();
	for (let id = 0; id < maxFunctionId; id++) {
		const swiEntryA = swilibs[0].entries[id];
		const swiEntryB = swilibs[1].entries[id];
		const sdkEntry = sdklib.entries[id];

		if (!swiEntryA && !swiEntryB)
			continue;

		const table = [
			['ID', 'Name', 'Swilib A', 'Swilib B'],
			[
				formatId(id),
				sdkEntry ? formatFuncName(sdkEntry.name) : chalk.grey('/* none */'),
				swiEntryA?.value != null ? sprintf("%08X", swiEntryA.value) : chalk.gray('/* none */'),
				swiEntryB?.value != null ? sprintf("%08X", swiEntryB.value) : chalk.gray('/* none */'),
			]
		];

		const isEntryValid = (index: number): boolean => {
			if (analysis[index].errors[id])
				return false;
			if (swilibs[index].entries[id]?.value == null)
				return false;
			return true;
		};

		let needMerge = false;
		if (analysis[0].errors[id] || analysis[1].errors[id]) {
			if (analysis[0].errors[id])
				table[1][2] = chalk.red(table[1][2]);
			if (analysis[1].errors[id])
				table[1][3] = chalk.red(table[1][3]);

			console.log(asciiTable(table).trim());

			if (analysis[0].errors[id])
				console.log('Swilib A error:', chalk.red(analysis[0].errors[id]));
			if (analysis[1].errors[id])
				console.log('Swilib B error:', chalk.red(analysis[1].errors[id]));
			needMerge = true;
		} else if ((swiEntryA && !swiEntryB) || (!swiEntryA && swiEntryB)) {
			needMerge = false;
			answers.set(id, swiEntryA ? 0 : 1);
		} else if (swiEntryA && swiEntryB && swiEntryA.value != swiEntryB.value) {
			console.log(asciiTable(table).trim());
			needMerge = true;
		}

		if (needMerge) {
			const choices: Array<{ name: string, value: number, disabled?: boolean }> = [];
			if (isEntryValid(0) && swiEntryA) {
				choices.push({ name: 'Swilib A: ' + sprintf("%08X", swiEntryA.value), value: 0 });
			} else {
				choices.push({ name: 'Swilib A: not available', value: 0, disabled: true });
			}
			if (isEntryValid(1) && swiEntryB) {
				choices.push({ name: 'Swilib B: ' + sprintf("%08X", swiEntryB.value), value: 1 });
			} else {
				choices.push({ name: 'Swilib B: not available', value: 0, disabled: true });
			}
			choices.push({ name: 'Remove from swilib', value: -1 });

			const answer = await inquirer.select({
				message: 'Choose right variant.',
				choices
			});
			answers.set(id, answer);

			console.log();
			console.log();
			console.log();
		}
	}

	const newSwilib: Swilib = {
		offset: swilibs[1].offset,
		entries: [],
		target,
		platform,
	};

	const summaryTable = [
		['ID', 'Name', 'Swilib A', 'Swilib B']
	];
	for (let id = 0; id < maxFunctionId; id++) {
		const swiEntryA = swilibs[0].entries[id];
		const swiEntryB = swilibs[1].entries[id];
		const sdkEntry = sdklib.entries[id];
		const swiEntryStrA = swiEntryA?.value != null ? sprintf("%08X", swiEntryA.value) : '';
		const swiEntryStrB = swiEntryB?.value != null ? sprintf("%08X", swiEntryB.value) : '';

		if (!answers.has(id)) {
			if (swilibs[1].entries[id]) {
				newSwilib.entries[id] = structuredClone(swilibs[1].entries[id]);
				delete newSwilib.entries[id].comment;
			}
			continue;
		}

		const answer = answers.get(id)!;
		if (answer == -1) {
			summaryTable.push([
				chalk.strikethrough.red(formatId(id)),
				chalk.strikethrough.red(sdkEntry ? formatFuncName(sdkEntry.name) : '/* none */'),
				chalk.strikethrough.red(swiEntryStrA),
				chalk.strikethrough.red(swiEntryStrB),
			]);
		} else {
			newSwilib.entries[id] = structuredClone(swilibs[answer].entries[id]);
			delete newSwilib.entries[id].comment;
			summaryTable.push([
				formatId(id),
				sdkEntry ? formatFuncName(sdkEntry.name) : chalk.grey('/* none */'),
				answer == 0 ? chalk.bold.green(swiEntryStrA) : chalk.gray(swiEntryStrA),
				answer == 1 ? chalk.bold.green(swiEntryStrB) : chalk.gray(swiEntryStrB),
			]);
		}
	}

	console.log(asciiTable(summaryTable));

	fs.writeFileSync(output, serializeSwilib(swilibConfig, newSwilib, sdklib));
	console.log(`Saved to ${output}`);
});

function formatFuncName(signature?: string): string {
	if (!signature)
		return chalk.gray('// unused');
	const m = signature.trim().match(/^(.*?)\s+([*]+)?([\w\d]+)\s*\((.+?)?\)$/is);
	if (m) {
		const args = m[4] != "" && m[4] != "void" ? "…" : "void";
		return `${m[1]} ${m[2] || ''}${chalk.bold(m[3])}${chalk.gray('(' + args + ')')}`;
	}
	return signature;
}

function formatId(id: number): string {
	return id.toString(16).padStart(3, '0').toUpperCase();
}

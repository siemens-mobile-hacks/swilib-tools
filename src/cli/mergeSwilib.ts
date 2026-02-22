import fs from 'fs';
import chalk from 'chalk';
import * as inquirer from '@inquirer/prompts';
import { table as asciiTable } from 'table';
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
import { SDK_DIR } from "#src/utils/sdk.js";
import { getSwilibDiff, SwilibDiffAction, SwilibEntryDiffSide } from "#src/merge.js";

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

	const swilibs: Swilib[] = [];
	for (const file of [source, destination])
		swilibs.push(parseSwilibPatch(swilibConfig, fs.readFileSync(file), { target }));
	const maxFunctionId = Math.max(...swilibs.map(swilib => swilib.entries.length));

	if (swilibs[0].offset != swilibs[1].offset) {
		console.error(chalk.red(`The swilibs have different base offsets; merging is not possible.`));
		return;
	}

	const answers = new Map<number, number>();
	const diff = await getSwilibDiff(platform, swilibs);
	for (const entry of diff) {
		const formatValue = (side?: SwilibEntryDiffSide) => {
			if (!side)
				return chalk.grey('/* none */');
			const valueHex = sprintf("%08X", side.value);
			return side.error ? chalk.red(valueHex) : valueHex;
		};

		const table = [
			['ID', 'Name', 'Swilib A', 'Swilib B'],
			[
				formatId(entry.id),
				entry.name ? formatFuncName(entry.name) : chalk.grey('/* none */'),
				formatValue(entry.left),
				formatValue(entry.right),
			]
		];

		if (entry.action == SwilibDiffAction.LEFT && !entry.right) {
			answers.set(entry.id, 0);
		} else if (entry.action == SwilibDiffAction.RIGHT && !entry.left) {
			answers.set(entry.id, 1);
		} else {
			console.log(asciiTable(table).trim());

			if (entry.left?.error)
				console.log('Swilib A error:', chalk.red(entry.left?.error));
			if (entry.right?.error)
				console.log('Swilib B error:', chalk.red(entry.right?.error));

			const choices: Array<{ name: string, value: number, disabled?: boolean }> = [];
			if ([SwilibDiffAction.LEFT, SwilibDiffAction.ASK].includes(entry.action)) {
				choices.push({ name: 'Swilib A: ' + sprintf("%08X", entry.left!.value), value: 0 });
			} else {
				choices.push({ name: 'Swilib A: not available', value: 0, disabled: true });
			}
			if ([SwilibDiffAction.RIGHT, SwilibDiffAction.ASK].includes(entry.action)) {
				choices.push({ name: 'Swilib B: ' + sprintf("%08X", entry.right!.value), value: 1 });
			} else {
				choices.push({ name: 'Swilib B: not available', value: 1, disabled: true });
			}
			choices.push({ name: 'Remove from swilib', value: -1 });

			const answer = await inquirer.select({
				message: 'Choose the correct variant:',
				choices
			});
			answers.set(entry.id, answer);

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
				delete newSwilib.entries[id]!.comment;
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
			delete newSwilib.entries[id]!.comment;
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

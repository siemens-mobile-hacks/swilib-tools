import fs from 'fs';
import chalk from 'chalk';
import { table as asciiTable, getBorderCharacters } from 'table';
import { getSdkDir } from '../utils.js';
import { analyzeSwilib } from '../analyze.js';
import swilibConfig from '../config.js';
import { parsePatterns, parseSwilibPatch, getPlatformSwilibFromSDK } from '@sie-js/swilib';

const SDK_DIR = getSdkDir();

const tableConfig = {
	singleLine: true,
	border: getBorderCharacters('void')
};

export async function checkSwilibCmd({ file, platform }) {
	console.log(`Checking ${file} (${platform})`);
	console.log();

	let swilib = parseSwilibPatch(fs.readFileSync(file));
	let sdklib = getPlatformSwilibFromSDK(SDK_DIR, platform);
	let analysis = analyzeSwilib(platform, sdklib, swilib);

	let patterns = parsePatterns(fs.readFileSync(`${getSdkDir()}/swilib/patterns/${platform}.ini`));

	// FIXME
	swilib.entries[sdklib.length - 1] = swilib.entries[sdklib.length - 1] || undefined;

	if (analysis.missing.length > 0) {
		let errorsTable = [
			[chalk.bold('ID'), chalk.bold('Name'), chalk.bold(`Notes`)]
		];
		for (let id of analysis.missing) {
			let func = sdklib[id];
			let notes = [];

			if (patterns[id]?.pattern)
				notes.push(chalk.green('has pattern'));

			if (swilibConfig.fromPatches.includes(id))
				notes.push(chalk.red('patch'));

			console.log(func);

			let row = [
				formatId(id),
				formatFuncName(sdklib[id]?.name),
				notes.length ? chalk.gray(notes.join(', ')) : ""
			];
			errorsTable.push(row);
		}

		console.log(chalk.bold(chalk.yellow(`Missing functions:`)));
		console.log(asciiTable(errorsTable, tableConfig));
	} else {
		console.log(chalk.bold(chalk.green('No missing functions in swilib!')));
	}

	if (Object.keys(analysis.errors).length > 0) {
		let errorsTable = [
			[chalk.bold('ID'), chalk.bold('SDK'), chalk.bold('Swilib'), chalk.bold('Error')]
		];

		for (let id in analysis.errors) {
			let row = [
				formatId(id),
					formatFuncName(sdklib[id]?.name),
						swilib.entries[id]?.symbol || chalk.gray('// empty'),
						chalk.red(analysis.errors[id])
			];
			errorsTable.push(row);
		}

		console.log(chalk.bold(chalk.red(`Functions with error:`)));
		console.log(asciiTable(errorsTable, tableConfig));
	} else {
		console.log(chalk.bold(chalk.green('No errors in swilib!')));
	}

	printSummaryStat(sdklib, analysis);
}

function printSummaryStat(sdklib, analysis) {
	let errorsCnt = 0;
	let missingCnt = 0;
	let goodCnt = 0;
	let totalCnt = sdklib.length;

	for (let id = 0; id < totalCnt; id++) {
		if (analysis.errors[id]) {
			errorsCnt++;
		} else if (analysis.missing.includes(id)) {
			missingCnt++;
		} else {
			goodCnt++;
		}
	}

	let calcPct = (v) => (v / totalCnt * 100).toFixed(0) + '%';

	let summaryTable = [
		[chalk.green(chalk.bold('Good functions:')), chalk.greenBright(goodCnt), chalk.greenBright(calcPct(goodCnt))],
		[chalk.red(chalk.bold('Bad functions:')), chalk.redBright(errorsCnt), chalk.redBright(calcPct(errorsCnt))],
		[chalk.yellow(chalk.bold('Missing functions:')), chalk.yellowBright(missingCnt), chalk.yellowBright(calcPct(missingCnt))],
	];

	console.log(asciiTable(summaryTable, tableConfig));
}

function formatFuncName(signature) {
	if (!signature)
		return chalk.gray('// unused');
	let m = signature.trim().match(/^(.*?)\s+([*]+)?([\w\d]+)\s*\((.+?)?\)$/is);
	if (m) {
		let args = m[4] != "" && m[4] != "void" ? "…" : "void";
		return `${m[1]} ${m[2] || ''}${chalk.bold(m[3])}${chalk.gray('(' + args + ')')}`;
	}
	return signature;
}

function formatId(id) {
	return (+id).toString(16).padStart(3, 0).toUpperCase();
}

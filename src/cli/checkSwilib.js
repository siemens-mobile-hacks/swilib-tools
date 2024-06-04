import fs from 'fs';
import chalk from 'chalk';
import { table as asciiTable, getBorderCharacters } from 'table';
import { getPatchByID, SDK_DIR } from '../utils.js';
import { swilibConfig, parsePatterns, parseSwilibPatch, getPlatformSwilibFromSDK, getPlatformByPhone, analyzeSwilib } from '@sie-js/swilib';

const tableConfig = {
	singleLine: true,
	border: getBorderCharacters('void')
};

export async function checkSwilibCmd({ file, phone }) {
	let platform;
	if (swilibConfig.platforms.includes(phone)) {
		platform = phone;
	} else {
		platform = getPlatformByPhone(phone);
		if (!file && swilibConfig.patches[phone]) {
			let patchId = swilibConfig.patches[phone];
			file = getPatchByID(patchId);
		}
	}

	if (!file) {
		console.error(`File is not specified.`);
		return;
	}

	console.log(`Checking ${file} (${platform})`);
	console.log();

	let swilib = parseSwilibPatch(fs.readFileSync(file));
	let sdklib = getPlatformSwilibFromSDK(SDK_DIR, platform);
	let analysis = analyzeSwilib(platform, sdklib, swilib);

	let patterns = parsePatterns(fs.readFileSync(`${SDK_DIR}/swilib/patterns/${platform}.ini`));

	// FIXME
	swilib.entries[sdklib.length - 1] = swilib.entries[sdklib.length - 1] || undefined;

	if (analysis.missing.length > 0) {
		let errorsTable = [
			[chalk.bold('ID'), chalk.bold('Name'), chalk.bold(`Notes`)]
		];
		for (let id of analysis.missing) {
			let notes = [];

			if (patterns[id]?.pattern)
				notes.push(chalk.green('has pattern'));

			if (swilibConfig.fromPatches.includes(id))
				notes.push(chalk.red('patch'));

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

	printSummaryStat(analysis.stat);
}

function printSummaryStat(stat) {
	let calcPct = (v) => Math.round(v / stat.total * 100) + '%';
	let summaryTable = [
		[chalk.green(chalk.bold('Good functions:')), chalk.greenBright(stat.good), chalk.greenBright(calcPct(stat.good))],
		[chalk.red(chalk.bold('Bad functions:')), chalk.redBright(stat.bad), chalk.redBright(calcPct(stat.bad))],
		[chalk.yellow(chalk.bold('Missing functions:')), chalk.yellowBright(stat.missing), chalk.yellowBright(calcPct(stat.missing))],
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

import fs from 'node:fs';
import chalk from 'chalk';
import { table as asciiTable, getBorderCharacters } from 'table';
import { swilibConfig, parsePatterns, parseSwilibPatch, getPlatformSwilibFromSDK, getPlatformByPhone, analyzeSwilib } from '@sie-js/swilib';
import { getPatchByID, SDK_DIR } from '../utils.js';

interface CheckSwilibOptions {
    file?: string;
    phone: string;
}

interface SwilibEntry {
    symbol?: string;
}

interface SwilibPatch {
    entries: (SwilibEntry | undefined)[];
}

interface SwilibFunction {
    name?: string;
    files: string[];
    platforms?: string[];
}

interface SwilibAnalysis {
    missing: number[];
    errors: Record<string, string>;
    stat: {
        total: number;
        good: number;
        bad: number;
        missing: number;
    };
}

const tableConfig = {
	singleLine: true,
	border: getBorderCharacters('void')
};

export async function checkSwilibCmd({ file, phone }: CheckSwilibOptions): Promise<void> {
	let platform: string;
	if (swilibConfig.platforms.includes(phone)) {
		platform = phone;
	} else {
		platform = getPlatformByPhone(phone);
		if (!file && swilibConfig.patches[phone]) {
			const patchId = swilibConfig.patches[phone];
			file = getPatchByID(patchId);
		}
	}

	if (!file) {
		console.error(`File is not specified.`);
		return;
	}

	console.log(`Checking ${file} (${platform})`);
	console.log();

	const swilib: SwilibPatch = parseSwilibPatch(fs.readFileSync(file));
	const sdklib: SwilibFunction[] = getPlatformSwilibFromSDK(SDK_DIR, platform);
	const analysis: SwilibAnalysis = analyzeSwilib(platform, sdklib, swilib);

	const patterns = parsePatterns(fs.readFileSync(`${SDK_DIR}/swilib/patterns/${platform}.ini`));

	// FIXME
	swilib.entries[sdklib.length - 1] = swilib.entries[sdklib.length - 1] || undefined;

	if (analysis.missing.length > 0) {
		const errorsTable = [
			[chalk.bold('ID'), chalk.bold('Name'), chalk.bold(`Notes`)]
		];
		for (let id of analysis.missing) {
			const func = sdklib[id];

			const notes: string[] = [];

			if (patterns[id]?.pattern)
				notes.push(chalk.green('has pattern'));

			if (func?.files.includes('swilib/patch.h'))
				notes.push(chalk.red('patch'));

			if (func?.platforms && !func.platforms.includes(platform))
				notes.push(chalk.grey('not available'));

			const row = [
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
		const errorsTable = [
			[chalk.bold('ID'), chalk.bold('SDK'), chalk.bold('Swilib'), chalk.bold('Error')]
		];

		for (let id in analysis.errors) {
			const row = [
				formatId(parseInt(id)),
				formatFuncName(sdklib[parseInt(id)]?.name),
				swilib.entries[parseInt(id)]?.symbol || chalk.gray('// empty'),
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

function printSummaryStat(stat: { total: number; good: number; bad: number; missing: number }): void {
	const calcPct = (v: number): string => Math.round(v / stat.total * 100) + '%';
	const summaryTable = [
		[chalk.green(chalk.bold('Good functions:')), chalk.greenBright(stat.good), chalk.greenBright(calcPct(stat.good))],
		[chalk.red(chalk.bold('Bad functions:')), chalk.redBright(stat.bad), chalk.redBright(calcPct(stat.bad))],
		[chalk.yellow(chalk.bold('Missing functions:')), chalk.yellowBright(stat.missing), chalk.yellowBright(calcPct(stat.missing))],
	];
	console.log(asciiTable(summaryTable, tableConfig));
}

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

import chalk from 'chalk';
import { getBorderCharacters, table as asciiTable } from 'table';
import { formatFuncName, formatId } from "#src/utils/format.js";
import { CLIBaseOptions } from "#src/cli.js";
import { createAppCommand } from "#src/utils/command.js";
import { analyzeSwilib } from "@sie-js/swilib";
import { loadLibraryForTarget } from "#src/utils/swilib.js";

const tableConfig = {
	singleLine: true,
	border: getBorderCharacters('void')
};

interface Options extends CLIBaseOptions {
	target: string;
	file?: string;
}

export default createAppCommand<Options>(async ({ target, file }) => {
	const {
		swilibConfig,
		platform,
		ptrlib,
		sdklib,
		swilib
	} = await loadLibraryForTarget(target, file);

	console.log(`Checking ${file} (${platform})`);
	console.log();

	const analysis = analyzeSwilib(swilibConfig, swilib, sdklib);
	if (analysis.missing.length > 0) {
		const errorsTable = [
			[chalk.bold('ID'), chalk.bold('Name'), chalk.bold(`Notes`)]
		];
		for (let id of analysis.missing) {
			const sdkEntry = sdklib.entries[id];
			const ptrEntry = ptrlib[id];

			const notes: string[] = [];

			if (ptrEntry?.pattern)
				notes.push(chalk.green('has pattern'));

			if (sdkEntry?.files.includes('swilib/patch.h'))
				notes.push(chalk.red('patch'));

			if (sdkEntry?.platforms && !sdkEntry.platforms.includes(platform))
				notes.push(chalk.grey('not available'));

			errorsTable.push([
				formatId(id),
				formatFuncName(sdkEntry?.name),
				notes.length ? chalk.gray(notes.join(', ')) : ""
			]);
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
		for (const [key, error] of Object.entries(analysis.errors)) {
			const id = parseInt(key);
			const sdkEntry = sdklib.entries[id];
			const swiEntry = swilib.entries[id];
			errorsTable.push([
				formatId(id),
				formatFuncName(sdkEntry?.name),
				swiEntry?.symbol || chalk.gray('// empty'),
				chalk.red(error)
			]);
		}
		console.log(chalk.bold(chalk.red(`Functions with error:`)));
		console.log(asciiTable(errorsTable, tableConfig));
	} else {
		console.log(chalk.bold(chalk.green('No errors in swilib!')));
	}

	printSummaryStat(analysis.stat);
});

function printSummaryStat(stat: { total: number; good: number; bad: number; missing: number }): void {
	const calcPct = (v: number): string => Math.round(v / stat.total * 100) + '%';
	const summaryTable = [
		[chalk.green(chalk.bold('Good functions:')), chalk.greenBright(stat.good), chalk.greenBright(calcPct(stat.good))],
		[chalk.red(chalk.bold('Bad functions:')), chalk.redBright(stat.bad), chalk.redBright(calcPct(stat.bad))],
		[chalk.yellow(chalk.bold('Missing functions:')), chalk.yellowBright(stat.missing), chalk.yellowBright(calcPct(stat.missing))],
	];
	console.log(asciiTable(summaryTable, tableConfig));
}

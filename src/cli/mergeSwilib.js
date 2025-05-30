import fs from 'fs';
import inquirer from 'inquirer';
import { table as asciiTable } from 'table';
import { analyzeSwilib, getPlatformByPhone, getPlatformSwilibFromSDK, parseSwilibPatch, serializeSwilib, swilibConfig } from "@sie-js/swilib";
import { SDK_DIR } from '../utils.js';
import chalk from 'chalk';
import { sprintf } from 'sprintf-js';

export async function mergeSwilib({ phone, file_a, file_b, new_file: newFile }) {
	const platform = swilibConfig.platforms.includes(phone) ? phone : getPlatformByPhone(phone);
	const sdklib = getPlatformSwilibFromSDK(SDK_DIR, platform);

	let analysis = [];
	let swilibs = [];

	let maxFunctionId = 0;
	for (let code of [ fs.readFileSync(file_a), fs.readFileSync(file_b) ]) {
		const swilib = parseSwilibPatch(code, { comments: true });
		swilibs.push(swilib);
		analysis.push(analyzeSwilib(platform, sdklib, swilib));
		maxFunctionId = Math.max(swilib.entries.length, maxFunctionId);
	}

	if (swilibs[0].offset != swilibs[1].offset) {
		console.error(chalk.red(`Swilibs have different base offsets, merge is not possible.`));
		return;
	}

	let answers = {};
	for (let id = 0; id < maxFunctionId; id++) {
		const funcA = swilibs[0].entries[id];
		const funcB = swilibs[1].entries[id];

		if (!funcA && !funcB)
			continue;

		let table = [
			['ID', 'Name', 'Swilib A', 'Swilib B'],
			[
				formatId(id),
				sdklib[id] ? formatFuncName(sdklib[id].name) : chalk.grey('/* none */'),
				funcA?.value != null ? sprintf("%08X", funcA.value) : chalk.gray('/* none */'),
				funcB?.value != null ? sprintf("%08X", funcB.value) : chalk.gray('/* none */'),
			]
		];

		let isValid = (index) => {
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
		} else if ((funcA && !funcB) || (!funcA && funcB)) {
			needMerge = false;
			answers[id] = funcA ? 0 : 1;
		} else if (funcA.value != funcB.value) {
			console.log(asciiTable(table).trim());
			needMerge = true;
		}

		if (needMerge) {
			let choices = [];
			if (isValid(0)) {
				choices.push({ name: 'Swilib A: ' + sprintf("%08X", funcA.value), value: 0 });
			} else {
				choices.push({ name: 'Swilib A: not available', disabled: true });
			}
			if (isValid(1)) {
				choices.push({ name: 'Swilib B: ' + sprintf("%08X", funcB.value), value: 1 });
			} else {
				choices.push({ name: 'Swilib B: not available', disabled: true });
			}
			choices.push({ name: 'Remove from swilib', value: -1 });

			answers = await inquirer.prompt({
				name: id.toString(),
				type: 'list',
				message: 'Choose right variant.',
				choices
			}, answers);
			console.log();
			console.log();
			console.log();
		}
	}

	let newSwilib = {
		offset: swilibs[1].offset,
		entries: [...swilibs[1].entries],
	};

	let summaryTable = [
		['ID', 'Name', 'Swilib A', 'Swilib B']
	];
	for (let id in answers) {
		id = parseInt(id);

		let funcA = swilibs[0].entries[id];
		let funcB = swilibs[1].entries[id];
		let funcAStr = funcA?.value != null ? sprintf("%08X", funcA.value) : '';
		let funcBStr = funcB?.value != null ? sprintf("%08X", funcB.value) : '';

		if (answers[id] == -1) {
			delete newSwilib.entries[id];
			summaryTable.push([
				chalk.strikethrough.red(formatId(id)),
				chalk.strikethrough.red(sdklib[id] ? formatFuncName(sdklib[id].name) : '/* none */'),
				chalk.strikethrough.red(funcAStr),
				chalk.strikethrough.red(funcBStr),
			]);
		} else {
			if (newSwilib.entries[id]?.value !== swilibs[answers[id]].entries[id].value) {
				newSwilib.entries[id] = swilibs[answers[id]].entries[id];
				delete newSwilib.entries[id].comment;
			}

			summaryTable.push([
				formatId(id),
				sdklib[id] ? formatFuncName(sdklib[id].name) : chalk.grey('/* none */'),
				answers[id] == 0 ? chalk.bold.green(funcAStr) : chalk.gray(funcAStr),
				answers[id] == 1 ? chalk.bold.green(funcBStr) : chalk.gray(funcBStr),
			]);
		}
	}

	console.log(asciiTable(summaryTable).trim());

	fs.writeFileSync(newFile, serializeSwilib(phone, sdklib, newSwilib))
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

import fs from 'fs';
import { table as asciiTable } from 'table';
import { getSwilibConfig, parseSwilibPatch, getPlatformSwilibFromSDK, parsePatterns } from './src/swilib.js';
import { getConfig, getPatchByID, SDK_DIR } from './src/utils.js';

main();

function main() {
	let patchesCfg = getConfig('patches');

	for (let model in patchesCfg.library) {
		let patchId = patchesCfg.library[model];

		let patchFile = getPatchByID(patchId, model);

		// console.log(`${patchId}: ${patchFile}`);
	}

	let patternsFuncs = parsePatterns(fs.readFileSync(`${SDK_DIR}/swilib/patterns/ELKA.ini`));
	let sdkFuncs = getPlatformSwilibFromSDK(SDK_DIR, "ELKA");

	let maxFunctionId = Math.max(patternsFuncs.length, sdkFuncs.length);

	console.log('maxFunctionId=' + maxFunctionId, patternsFuncs.length, sdkFuncs.length);

	let table = [['ID', 'SDK', 'PTR', '?']];
	let errors = 0;
	for (let i = 0; i < maxFunctionId; i++) {
		let matched = isSameFunctions(sdkFuncs[i], patternsFuncs[i]);
		if (!matched) {
			table.push([
				i.toString(16).padStart('0', 3),
				sdkFuncs[i] ? sdkFuncs[i].symbol : '-',
				patternsFuncs[i] ? patternsFuncs[i].symbol : '-',
				matched ? '✅' : '❌',
			]);

			if (sdkFuncs[i] && patternsFuncs[i]) {
				console.log(`0x${i.toString(16).padStart(3, '0').toUpperCase()}: ["${patternsFuncs[i].symbol}"],`);
			}

			errors++;
		}
	}

	console.log(asciiTable(table));
	console.log(`errors=${errors}`);
}

function isSameFunctions(oldFunc, newFunc) {
	let swilibConfig = getSwilibConfig();
	if (!oldFunc && !newFunc)
		return true;
	if (!oldFunc || !newFunc)
		return false;
	if (oldFunc.id != newFunc.id)
		return false;
	if (oldFunc.symbol == newFunc.symbol)
		return true;
	if (swilibConfig.aliases[+oldFunc.id] && swilibConfig.aliases[+oldFunc.id].includes(oldFunc.symbol))
		return true;
	if (swilibConfig.aliases[+oldFunc.id] && swilibConfig.aliases[+oldFunc.id].includes(newFunc.symbol))
		return true;
	if (newFunc.aliases && newFunc.aliases.includes(oldFunc.symbol))
		return true;
	if (oldFunc.aliases && oldFunc.aliases.includes(newFunc.symbol))
		return true;
	return false;
}

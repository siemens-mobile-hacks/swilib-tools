import fs from 'fs';
import { getPlatformByPhone } from '@sie-js/swilib';
import { getPatchByID, SDK_DIR } from './utils.js';
import { getPlatformSwilibFromSDKCached, parseSwilibPatchCached } from './cache.js';
import swilibConfig from './config.js';

export const SwiType = {
	EMPTY:		0,
	FUNCTION:	1,
	POINTER:	2,
	VALUE:		3,
};

export const SwiFlags = {
	BUILTIN:		1 << 0,
	FROM_PATCH:		1 << 1,
};

const functionPairs = getFunctionPairs();

export function getFunctionsForPhone(phone) {
	let patchId = swilibConfig.patches[phone];
	let patchFile = getPatchByID(patchId, phone);
	let platform = getPlatformByPhone(phone);
	let sdklib = getPlatformSwilibFromSDKCached(SDK_DIR, platform);

	let swilib = parseSwilibPatchCached(fs.readFileSync(patchFile));
	let analyze = analyzeSwilib(phone, sdklib, swilib);

	swilib.entries[sdklib.length - 1] = swilib.entries[sdklib.length - 1] || undefined;

	return {
		patchId,
		errors: analyze.errors,
		missing: analyze.missing,
		address: 0xA0000000 + swilib.offset,
		values: swilib.entries.map((entry) => entry?.value),
		symbols: swilib.entries.map((entry) => entry?.symbol),
	};
}

export function getFunctionsSummary() {
	let coverage = {};
	let phonesCoverage = {};
	let platformToLib = {};
	let functionsByPhone = {};
	let maxFunctionId = 0;

	for (let platform of ["ELKA", "NSG", "X75", "SG"]) {
		platformToLib[platform] = getPlatformSwilibFromSDKCached(SDK_DIR, platform);
		maxFunctionId = Math.max(maxFunctionId, platformToLib[platform].length);
	}

	for (let phone of swilibConfig.phones) {
		let patchId = swilibConfig.patches[phone];
		let patchFile = getPatchByID(patchId, phone);
		let platform = getPlatformByPhone(phone);
		let sdklib = platformToLib[platform];

		let swilib = parseSwilibPatchCached(fs.readFileSync(patchFile));
		let { missing, errors, types } = analyzeSwilib(phone, sdklib, swilib);

		let goodFunctionsCnt = 0;
		for (let id = 0; id < sdklib.length; id++) {
			let func = sdklib[id];
			if (func) {
				coverage[platform] = coverage[platform] || {};
				coverage[platform][id] = coverage[platform][id] || { ok: 0, bad: 0 };

				coverage["ALL"] = coverage["ALL"] || {};
				coverage["ALL"][id] = coverage["ALL"][id] || { ok: 0, bad: 0 };

				if (!missing.includes(id) && !errors[id]) {
					functionsByPhone[phone] = functionsByPhone[phone] || [];
					functionsByPhone[phone].push(id);
					goodFunctionsCnt++;
					coverage[platform][id].ok++;
					coverage["ALL"][id].ok++;
				} else {
					coverage[platform][id].bad++;
					coverage["ALL"][id].bad++;
				}
			}
		}

		phonesCoverage[phone] = +(goodFunctionsCnt / sdklib.length * 100).toFixed(1);
	}

	let allFunctions = [];
	let allFunctionsByFile = {};
	for (let id = 0; id < maxFunctionId; id++) {
		let func = platformToLib.ELKA[id] || platformToLib.NSG[id] || platformToLib.X75[id] || platformToLib.SG[id];
		if (func) {
			let allPossibleAliases = [];
			for (let platform of ["ELKA", "NSG", "X75", "SG"]) {
				let sdklib = platformToLib[platform];
				if (sdklib[id]) {
					allPossibleAliases.push(sdklib[id].symbol);
					for (let aliasName of sdklib[id].aliases)
						allPossibleAliases.push(aliasName);
				}
			}

			if (swilibConfig.aliases[id]) {
				for (let aliasName of swilibConfig.aliases[id])
					allPossibleAliases.push(aliasName);
			}

			let aliases = [];
			for (let aliasName of allPossibleAliases) {
				if (aliasName != func.symbol && !isStrInArray(aliases, aliasName))
					aliases.push(aliasName);
			}

			let functionCoverage = [];
			for (let platform of ["ELKA", "NSG", "X75", "SG"]) {
				if (swilibConfig.builtin[id]?.includes(platform)) {
					functionCoverage.push(200); // special value "builtin"
				} else if (swilibConfig.platformDependentFunctions[id]?.includes(platform)) {
					functionCoverage.push(-200); // special value "not available"
				} else {
					let coveragePct = coverage[platform][id].ok / (coverage[platform][id].ok + coverage[platform][id].bad) * 100;
					functionCoverage.push(+coveragePct.toFixed(1));
				}
			}

			let flags = 0;
			if (swilibConfig.fromPatches.includes(id))
				flags |= SwiFlags.FROM_PATCH;
			if ((id in swilibConfig.builtin))
				flags |= SwiFlags.BUILTIN;

			let file = func.files[0];

			let funcInfo = {
				id,
				name: func.name,
				aliases,
				flags,
				type: func.functions.length ? SwiType.FUNCTION : SwiType.POINTER,
				coverage: functionCoverage,
			};

			allFunctionsByFile[file] = allFunctionsByFile[file] || [];
			allFunctionsByFile[file].push(funcInfo);
			allFunctions[id] = funcInfo;
		} else {
			let file = "swilib/unused.h";
			let funcInfo = {
				id,
				name: null,
				aliases: [],
				type: SwiType.EMPTY,
				coverage: [null, null, null, null, null],
			};
			allFunctionsByFile[file] = allFunctionsByFile[file] || [];
			allFunctionsByFile[file].push(funcInfo);
			allFunctions[id] = funcInfo;
		}
	}

	return {
		functions: allFunctions,
		functionsByFile: allFunctionsByFile,
		functionsByPhone: functionsByPhone,
		coverage: phonesCoverage,
		maxFunctionId
	};
}

export function analyzeSwilib(platform, sdklib, swilib) {
	let maxFunctionId = Math.max(sdklib.length, swilib.entries.length);
	let errors = {};
	let duplicates = {};
	let missing = [];

	for (let id = 0; id < maxFunctionId; id++) {
		let func = swilib.entries[id];
		if (!sdklib[id] && !func)
			continue;

		if (!sdklib[id] && func) {
			errors[id] = `Unknown function: ${func.symbol}`;
			continue;
		}

		if (functionPairs[id]) {
			let masterFunc = swilib.entries[functionPairs[id][0]];
			if (masterFunc && (!func || masterFunc.value != func.value)) {
				let expectedValue = masterFunc.value.toString(16).padStart(8, '0').toUpperCase();
				errors[id] = `Address must be equal with #${formatId(masterFunc.id)} ${masterFunc.symbol} (0x${expectedValue}).`;
			}
		}

		if (sdklib[id] && !func) {
			if (!(id in swilibConfig.builtin))
				missing.push(id);
			continue;
		}

		if (swilibConfig.builtin[id]?.includes(platform) && func) {
			errors[id] = `Reserved by ELFLoader (${sdklib[id].symbol}).`;
			continue;
		}

		if (swilibConfig.platformDependentFunctions[id]?.includes(platform) && func) {
			errors[id] = `Functions is not available on this platform.`;
			continue;
		}

		if (!isSameFunctions(sdklib[id], func)) {
			errors[id] = `Invalid function: ${func.symbol}`;
			continue;
		}

		if ((BigInt(func.value) & 0xF0000000n) == 0xA0000000n) {
			if (duplicates[func.value]) {
				let dupId = duplicates[func.value];
				if (!functionPairs[func.id] || !functionPairs[func.id].includes(dupId))
					errors[id] = `Address already used for #${formatId(dupId)} ${sdklib[dupId].symbol}.`;
			}
		}
	}

	return { errors, missing };
}

function isStrInArray(arr, search) {
	if (arr) {
		search = search.toLowerCase();
		for (let word of arr) {
			if (word.toLowerCase() === search)
				return true;
		}
	}
	return false;
}

function formatId(id) {
	return (+id).toString(16).padStart(3, 0).toUpperCase();
}

function isSameFunctions(targetFunc, checkFunc) {
	if (!targetFunc && !checkFunc)
		return true;
	if (!targetFunc || !checkFunc)
		return false;
	if (targetFunc.id != checkFunc.id)
		return false;
	if (targetFunc.symbol == checkFunc.symbol)
		return true;
	if (isStrInArray(targetFunc.aliases, checkFunc.symbol))
		return true;
	if (isStrInArray(swilibConfig.aliases[+targetFunc.id], checkFunc.symbol))
		return true;
	return false;
}

function getFunctionPairs() {
	let functionPairs = {};
	for (let p of swilibConfig.pairs) {
		for (let i = 0; i < p.length; i++)
			functionPairs[p[i]] = p;
	}
	return functionPairs;
}

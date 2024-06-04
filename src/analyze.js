import fs from 'fs';
import { swilibConfig, analyzeSwilib, getPlatformByPhone, SwiType } from '@sie-js/swilib';
import { getPlatformSwilibFromSDKCached, parseSwilibPatchCached } from './cache.js';
import { getPatchByID } from './utils.js';

export const SwiFlags = {
	BUILTIN:		1 << 0,
	FROM_PATCH:		1 << 1,
};

export async function getPhoneSwilib(phone) {
	let patchId = swilibConfig.patches[phone];
	let patchFile = getPatchByID(patchId, phone);
	let platform = getPlatformByPhone(phone);
	let sdklib = await getPlatformSwilibFromSDKCached(platform);

	let swilib = await parseSwilibPatchCached(fs.readFileSync(patchFile));
	let analysis = analyzeSwilib(phone, sdklib, swilib);

	swilib.entries[sdklib.length - 1] = swilib.entries[sdklib.length - 1] || undefined;

	let swilibEntries = [];
	for (let id = 0; id < sdklib.length; id++) {
		let entry = {
			id: id,
			symbol: swilib.entries[id]?.symbol,
			value: swilib.entries[id]?.value,
			error: analysis.errors[id],
		};
		if (entry.value || entry.error)
			swilibEntries[id] = entry;
	}

	return { patchId, swilib: swilibEntries, offset: swilib.offset, platform };
}

export async function getFunctionsSummary() {
	let coverage = {};
	let phonesCoverage = {};
	let platformToLib = {};
	let functionsByPhone = {};
	let maxFunctionId = 0;

	for (let platform of ["ELKA", "NSG", "X75", "SG"]) {
		platformToLib[platform] = await getPlatformSwilibFromSDKCached(platform);
		maxFunctionId = Math.max(maxFunctionId, platformToLib[platform].length);
	}

	for (let phone of swilibConfig.phones) {
		let patchId = swilibConfig.patches[phone];
		let patchFile = getPatchByID(patchId, phone);
		let platform = getPlatformByPhone(phone);
		let sdklib = platformToLib[platform];

		let swilib = await parseSwilibPatchCached(fs.readFileSync(patchFile));
		let { missing, errors } = analyzeSwilib(phone, sdklib, swilib);

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
				file,
				type: func.type,
				coverage: functionCoverage,
			};
			allFunctions[id] = funcInfo;
		} else {
			let file = "swilib/unused.h";
			let funcInfo = {
				id,
				name: null,
				aliases: [],
				flags: 0,
				file,
				type: SwiType.EMPTY,
				coverage: [null, null, null, null],
			};
			allFunctions[id] = funcInfo;
		}
	}

	return {
		functions: allFunctions,
		functionsByPhone,
		phonesCoverage,
		maxFunctionId
	};
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

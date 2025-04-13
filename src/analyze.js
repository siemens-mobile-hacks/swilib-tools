import fs from 'fs';
import { swilibConfig, analyzeSwilib, getPlatformByPhone, SwiType, parsePatterns } from '@sie-js/swilib';
import { getPlatformSwilibFromSDKCached, parsePatternsCached, parseSwilibPatchCached } from './cache.js';
import { getPatchByID } from './utils.js';

export const SwiFlags = {
	BUILTIN:		1 << 0,
	FROM_PATCH:		1 << 1,
	DIRTY:			1 << 2,
};

export async function getPhoneSwilib(phone) {
	const patchId = swilibConfig.patches[phone];
	const patchFile = getPatchByID(patchId, phone);
	const platform = getPlatformByPhone(phone);
	const sdklib = await getPlatformSwilibFromSDKCached(platform);

	const swilib = await parseSwilibPatchCached(fs.readFileSync(patchFile));
	const analysis = analyzeSwilib(platform, sdklib, swilib);

	swilib.entries[sdklib.length - 1] = swilib.entries[sdklib.length - 1] || undefined;

	const swilibEntries = [];
	for (let id = 0; id < sdklib.length; id++) {
		const entry = {
			id: id,
			symbol: swilib.entries[id]?.symbol,
			value: swilib.entries[id]?.value,
			error: analysis.errors[id],
		};
		if (entry.value || entry.error)
			swilibEntries[id] = entry;
	}

	return { patchId, entries: swilibEntries, offset: swilib.offset, platform, stat: analysis.stat };
}

export async function getPatternsSummary() {
	const platformToLib = {};
	const platformToPatterns = {};
	let maxFunctionId = 0;

	for (let platform of swilibConfig.platforms) {
		platformToLib[platform] = await getPlatformSwilibFromSDKCached(platform);
		platformToPatterns[platform] = await parsePatternsCached(platform);
		maxFunctionId = Math.max(maxFunctionId, platformToLib[platform].length);
	}

	const allPatterns = [];
	for (let id = 0; id < maxFunctionId; id++) {
		const func = platformToLib.ELKA[id] || platformToLib.NSG[id] || platformToLib.X75[id] || platformToLib.SG[id];
		const ptr = platformToPatterns.ELKA[id] || platformToPatterns.NSG[id] || platformToPatterns.X75[id] || platformToPatterns.SG[id];

		const coverage = [];
		for (let platform of swilibConfig.platforms) {
			const patterns = platformToPatterns[platform];
			if (func?.builtin?.includes(platform)) {
				coverage.push(200); // special value "builtin"
			} else if (func.platforms && !func.platforms.includes(platform)) {
				coverage.push(-200); // special value "not available"
			} else {
				coverage.push(patterns[id]?.pattern != null ? 100 : 0);
			}
		}

		allPatterns[id] = {
			id,
			name: func?.name,
			symbol: func?.symbol,
			coverage
		};
	}

	console.log(allPatterns);
}

export async function getFunctionsSummary() {
	let coverage = {};
	let phonesCoverage = {};
	let platformToLib = {};
	let platformToPatterns = {};
	let functionsByPhone = {};
	let maxFunctionId = 0;

	for (let platform of swilibConfig.platforms) {
		platformToLib[platform] = await getPlatformSwilibFromSDKCached(platform);
		platformToPatterns[platform] = await parsePatternsCached(platform);
		maxFunctionId = Math.max(maxFunctionId, platformToLib[platform].length);
	}

	const dirtyEntries = {};
	for (let phone of swilibConfig.phones) {
		const patchId = swilibConfig.patches[phone];
		const patchFile = getPatchByID(patchId, phone);
		const platform = getPlatformByPhone(phone);
		const sdklib = platformToLib[platform];

		const swilib = await parseSwilibPatchCached(fs.readFileSync(patchFile));
		const { missing, errors } = analyzeSwilib(platform, sdklib, swilib);

		let goodFunctionsCnt = 0;
		for (let id = 0; id < sdklib.length; id++) {
			const func = sdklib[id];
			if (func) {
				coverage[platform] = coverage[platform] || {};
				coverage[platform][id] = coverage[platform][id] || { ok: 0, bad: 0 };

				coverage["ALL"] = coverage["ALL"] || {};
				coverage["ALL"][id] = coverage["ALL"][id] || { ok: 0, bad: 0 };

				if (!missing.includes(id) && !errors[id]) {
					goodFunctionsCnt++;
					coverage[platform][id].ok++;
					coverage["ALL"][id].ok++;
				} else {
					coverage[platform][id].bad++;
					coverage["ALL"][id].bad++;
				}
			} else {
				if (swilib.entries[id]?.value != null)
					dirtyEntries[id] = true;
			}

			if (!errors[id] && !missing.includes(id)) {
				functionsByPhone[phone] = functionsByPhone[phone] || [];
				functionsByPhone[phone].push(id);
			}
		}

		phonesCoverage[phone] = +(goodFunctionsCnt / sdklib.length * 100).toFixed(1);
	}

	const allFunctions = [];
	for (let id = 0; id < maxFunctionId; id++) {
		const func = platformToLib.ELKA[id] || platformToLib.NSG[id] || platformToLib.X75[id] || platformToLib.SG[id];
		if (func) {
			const allPossibleAliases = [];
			for (let platform of swilibConfig.platforms) {
				const sdklib = platformToLib[platform];
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

			const aliases = [];
			for (let aliasName of allPossibleAliases) {
				if (aliasName != func.symbol && !isStrInArray(aliases, aliasName))
					aliases.push(aliasName);
			}

			const functionCoverage = [];
			const patternCovarage = [];
			const patterns = [];
			for (let platform of swilibConfig.platforms) {
				const ptrlib = platformToPatterns[platform];
				if (func.builtin?.includes(platform)) {
					functionCoverage.push(200); // special value "builtin"
					patternCovarage.push(200); // special value "builtin"
				} else if (func.platforms && !func.platforms.includes(platform)) {
					functionCoverage.push(-200); // special value "not available"
					patternCovarage.push(-200); // special value "builtin"
				} else {
					const coveragePct = coverage[platform][id].ok / (coverage[platform][id].ok + coverage[platform][id].bad) * 100;
					functionCoverage.push(+coveragePct.toFixed(1));
					patternCovarage.push(ptrlib[id]?.pattern != null ? 100 : 0);
				}

				patterns.push(ptrlib[id]?.pattern);
			}

			let flags = 0;
			if (func.files.includes('swilib/patch.h'))
				flags |= SwiFlags.FROM_PATCH;
			if (func.builtin)
				flags |= SwiFlags.BUILTIN;
			if (dirtyEntries[id])
				flags |= SwiFlags.DIRTY;

			const file = func.files[0];

			const funcInfo = {
				id,
				name: func.name,
				aliases,
				flags,
				file,
				type: func.type,
				coverage: functionCoverage,
				ptrCoverage: patternCovarage,
				patterns
			};
			allFunctions[id] = funcInfo;
		} else {
			let flags = 0;
			if (dirtyEntries[id])
				flags |= SwiFlags.DIRTY;

			const file = "swilib/unused.h";
			const funcInfo = {
				id,
				name: null,
				aliases: [],
				flags,
				file,
				type: SwiType.EMPTY,
				coverage: [null, null, null, null],
				ptrCoverage: [null, null, null, null],
				patterns: [null, null, null, null],
			};
			allFunctions[id] = funcInfo;
		}
	}

	return {
		functions: allFunctions,
		functionsByPhone,
		phonesCoverage,
		nextId: maxFunctionId
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

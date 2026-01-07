import fs from 'node:fs';
import { getSwilibPatch, SDK_DIR } from './utils.js';
import {
	analyzeSwilib,
	getSwilibPlatform,
	getSwilibPlatforms,
	loadSwilibConfig,
	parseSwilibPatch,
	SwilibAnalysisResult,
	SwiPlatform,
	SwiType
} from "@sie-js/swilib";
import { loadLibraryForAll, loadLibraryForTarget } from "#src/utils/swilib.js";

export enum SwiFlags {
	NONE		= 0,
	BUILTIN		= 1 << 0,
	FROM_PATCH	= 1 << 1,
	DIRTY		= 1 << 2,
}

export interface PatternEntry {
	id: number;
	name?: string;
	symbol?: string;
	coverage: number[];
}

export interface SummarySwilibAnalysisEntry {
	id: number;
	name?: string;
	aliases: string[];
	flags: SwiFlags;
	file: string;
	type: SwiType;
	coverage: Record<string, number>;
	patterns: Record<string, string>;
	targets: string[];
}

export interface SummarySwilibAnalysis {
	entries: SummarySwilibAnalysisEntry[];
	coverage: Record<string, number>;
	nextId: number;
	files: string[];
}

export interface SwilibDevice {
	target: string;
	model: string;
	sw: number;
	platform: string;
	patchId: number;
}

interface TargetSwilibAnalysisEntry {
	id: number;
	symbol?: string;
	value?: number;
	error?: string;
	missing?: boolean;
}

interface TargetSwilibAnalysis {
	target: string;
	platform: SwiPlatform;
	entries: TargetSwilibAnalysisEntry[];
	offset: number;
	patchId: number;
	statistic: SwilibAnalysisResult['stat'];
}

export async function getPatternsSummaryAnalysis(): Promise<PatternEntry[]> {
	const { maxFunctionId, platformToLib, platformToPatterns } = await loadLibraryForAll();
	const allPatterns: PatternEntry[] = [];
	for (let id = 0; id < maxFunctionId; id++) {
		const sdkEntry = getSwilibPlatforms()
			.map(p => platformToLib[p].entries[id])
			.find(Boolean);

		const coverage: number[] = [];
		for (let platform of getSwilibPlatforms()) {
			const patterns = platformToPatterns[platform];
			if (sdkEntry?.builtin?.includes(platform)) {
				coverage.push(200); // special value "builtin"
			} else if (sdkEntry?.platforms && !sdkEntry.platforms.includes(platform)) {
				coverage.push(-200); // special value "not available"
			} else {
				coverage.push(patterns[id]?.pattern != null ? 100 : 0);
			}
		}

		allPatterns[id] = {
			id,
			name: sdkEntry?.name,
			symbol: sdkEntry?.symbol,
			coverage
		};
	}

	return allPatterns;
}

export function getSwilibDevices(): SwilibDevice[] {
	const swilibConfig = loadSwilibConfig(SDK_DIR);
	return swilibConfig.targets.map((target) => {
		const model = target.split('v')[0];
		const sw = +target.split('v')[1];
		return {
			target: target,
			model,
			sw,
			platform: swilibConfig.platforms.get(model)!,
			patchId: Number(swilibConfig.patches.get(target) ?? 0),
		};
	});
}

export async function getTargetSwilibAnalysis(target: string): Promise<TargetSwilibAnalysis> {
	const { swilibConfig, sdklib, swilib } = await loadLibraryForTarget(target);
	const analysis = analyzeSwilib(swilibConfig, swilib, sdklib);

	const entries: TargetSwilibAnalysisEntry[] = [];
	for (let id = 0; id < sdklib.entries.length; id++) {
		const swiEntry = swilib.entries[id];
		entries.push({
			id,
			symbol: swiEntry?.symbol,
			value: swiEntry?.value,
			error: analysis.errors[id],
			missing: analysis.missing.includes(id),
		});
	}

	return {
		target: swilib.target!,
		platform: swilib.platform,
		entries,
		offset: swilib.offset,
		patchId: swilibConfig.patches.get(target) ?? 0,
		statistic: analysis.stat,
	};
}

export async function getSwilibSummaryAnalysis(): Promise<SummarySwilibAnalysis> {
	const swilibConfig = loadSwilibConfig(SDK_DIR);
	const coverage: Record<string, Record<number, { ok: number; bad: number }>> = {};
	const targetCoverage: Record<string, number> = {};
	const targetToEntries: Record<string, number[]> = {};
	const dirtyEntries: Record<number, boolean> = {};
	const { maxFunctionId, platformToLib, platformToPatterns } = await loadLibraryForAll();

	for (const target of swilibConfig.targets) {
		const patchFile = getSwilibPatch(swilibConfig, target);
		if (!patchFile)
			continue;

		const platform = getSwilibPlatform(swilibConfig, target);
		const sdklib = platformToLib[platform];

		const swilib = parseSwilibPatch(swilibConfig, fs.readFileSync(patchFile), { target });
		const { missing, errors } = analyzeSwilib(swilibConfig, swilib, sdklib);

		let goodFunctionsCnt = 0;
		for (let id = 0; id < sdklib.entries.length; id++) {
			const sdkEntry = sdklib.entries[id];
			if (sdkEntry) {
				coverage[platform] = coverage[platform] ?? {};
				coverage[platform][id] = coverage[platform][id] ?? { ok: 0, bad: 0 };

				coverage["ALL"] = coverage["ALL"] ?? {};
				coverage["ALL"][id] = coverage["ALL"][id] ?? { ok: 0, bad: 0 };

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
				targetToEntries[target] = targetToEntries[target] || [];
				targetToEntries[target].push(id);
			}
		}

		targetCoverage[target] = +(goodFunctionsCnt / sdklib.entries.length * 100).toFixed(1);
	}

	const allFiles: string[] = [];
	const entries: SummarySwilibAnalysisEntry[] = [];
	for (let id = 0; id < maxFunctionId; id++) {
		const sdkEntry = getSwilibPlatforms()
			.map(p => platformToLib[p].entries[id])
			.find(Boolean);

		if (!sdkEntry) {
			let flags = SwiFlags.NONE;
			if (dirtyEntries[id])
				flags |= SwiFlags.DIRTY;

			const file = "swilib/unused.h";
			entries[id] = {
				id,
				name: undefined,
				aliases: [],
				flags,
				file,
				type: SwiType.EMPTY,
				coverage: {},
				patterns: {},
				targets: [],
			};
			continue;
		}

		const allPossibleAliases = getSwilibPlatforms().flatMap((platform) => {
			const entry = platformToLib[platform].entries[id];
			if (!entry)
				return [];
			return [entry.symbol ?? '', ...entry.aliases];
		});
		for (const aliasName of swilibConfig.functions.aliases.get(id) ?? [])
			allPossibleAliases.push(aliasName);

		const aliases: string[] = [];
		for (const aliasName of allPossibleAliases) {
			if (aliasName != sdkEntry.symbol && !isStrInArray(aliases, aliasName))
				aliases.push(aliasName);
		}

		const entryCoverage: Record<string, number> = {};
		const patterns: Record<string, string> = {};
		for (const platform of getSwilibPlatforms()) {
			const ptrlib = platformToPatterns[platform];
			const pattern = ptrlib[id]?.pattern;

			if (sdkEntry.builtin?.includes(platform)) {
				entryCoverage[platform] = 200; // special value "builtin"
			} else if (sdkEntry.platforms && !sdkEntry.platforms.includes(platform)) {
				entryCoverage[platform] = -200; // special value "not available"
			} else {
				const coveragePct = coverage[platform][id].ok / (coverage[platform][id].ok + coverage[platform][id].bad) * 100;
				entryCoverage[platform] = +coveragePct.toFixed(1);
				if (pattern)
					patterns[platform] = pattern;
			}
		}

		let flags = SwiFlags.NONE;
		if (sdkEntry.files.includes('swilib/patch.h'))
			flags |= SwiFlags.FROM_PATCH;
		if (sdkEntry.builtin)
			flags |= SwiFlags.BUILTIN;
		if (dirtyEntries[id])
			flags |= SwiFlags.DIRTY;

		const file = sdkEntry.files[0];
		if (!allFiles.includes(file))
			allFiles.push(file);

		entries[id] = {
			id,
			name: sdkEntry.name,
			aliases,
			flags,
			file,
			type: sdkEntry.type,
			coverage: entryCoverage,
			patterns,
			targets: Object.keys(targetToEntries).filter((target) => targetToEntries[target].includes(id)),
		};
	}

	return {
		entries: entries,
		coverage: targetCoverage,
		nextId: maxFunctionId,
		files: allFiles,
	};
}

function isStrInArray(arr: string[] | undefined, search: string): boolean {
	if (arr) {
		search = search.toLowerCase();
		for (let word of arr) {
			if (word.toLowerCase() === search)
				return true;
		}
	}
	return false;
}

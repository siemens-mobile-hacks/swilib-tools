import {
	analyzeSwilib,
	loadSwilibConfig,
	parseLibraryFromSDK,
	Swilib,
	SwilibAnalysisResult,
	SwiPlatform
} from "@sie-js/swilib";
import { SDK_DIR } from "#src/utils/sdk.js";

export enum SwilibDiffAction {
	LEFT,
	RIGHT,
	ASK,
	DELETE,
	SKIP,
}

export interface SwilibEntryDiffSide {
	value: number;
	error?: string;
}

export interface SwilibEntryDiff {
	id: number;
	name?: string;
	symbol?: string;
	left?: SwilibEntryDiffSide;
	right?: SwilibEntryDiffSide;
	action: SwilibDiffAction;
}

export async function getSwilibDiff(platform: SwiPlatform, swilibs: Swilib[]): Promise<SwilibEntryDiff[]> {
	const swilibConfig = await loadSwilibConfig(SDK_DIR);
	const sdklib = await parseLibraryFromSDK(SDK_DIR, platform);

	const analysis: SwilibAnalysisResult[] = [];
	for (const swilib of swilibs)
		analysis.push(analyzeSwilib(swilibConfig, swilib, sdklib));

	const maxFunctionId = Math.max(swilibs[0].entries.length, swilibs[1].entries.length);
	const difference: SwilibEntryDiff[] = [];
	for (let id = 0; id < maxFunctionId; id++) {
		const swiEntryA = swilibs[0].entries[id];
		const swiEntryB = swilibs[1].entries[id];
		const sdkEntry = sdklib.entries[id];

		if (!swiEntryA && !swiEntryB)
			continue;

		const entryDiff: SwilibEntryDiff = {
			id,
			name: sdkEntry?.name,
			symbol: sdkEntry?.symbol,
			left: swiEntryA && {
				value: swiEntryA.value,
				error: analysis[0].errors[id]
			},
			right: swiEntryB && {
				value: swiEntryB.value,
				error: analysis[1].errors[id]
			},
			action: SwilibDiffAction.SKIP
		};

		const leftValid = entryDiff.left && !entryDiff.left.error;
		const rightValid = entryDiff.right && !entryDiff.right.error;

		if (leftValid && rightValid) {
			if (entryDiff.left?.value !== entryDiff.right?.value)
				entryDiff.action = SwilibDiffAction.ASK;
		} else if (leftValid && !rightValid) {
			entryDiff.action = SwilibDiffAction.LEFT;
		} else if (!leftValid && rightValid) {
			entryDiff.action = SwilibDiffAction.RIGHT;
		} else {
			entryDiff.action = SwilibDiffAction.DELETE;
		}

		if (entryDiff.action != SwilibDiffAction.SKIP)
			difference.push(entryDiff);
	}

	return difference;
}

import fs from 'node:fs';
import {
	getSwilibPlatform,
	getSwilibPlatforms,
	loadSwilibConfig,
	parseLibraryFromSDK,
	parsePatterns,
	parseSwilibPatch,
	Sdklib, SwilibConfig,
	SwilibPattern,
	SwiPlatform
} from "@sie-js/swilib";
import { getSwilibPatch, SDK_DIR } from "#src/utils/sdk.js";

export async function loadLibraryForTarget(target: string, file?: string){
	const swilibConfig = loadSwilibConfig(SDK_DIR);
	const platform = getSwilibPlatform(swilibConfig, target);
	const ptrlib = parsePatterns(fs.readFileSync(`${SDK_DIR}/swilib/patterns/${platform}.ini`));
	const sdklib = await parseLibraryFromSDK(SDK_DIR, platform);

	if (!file)
		file = getSwilibPatch(swilibConfig, target);

	if (!file)
		throw new Error(`swilib.vkp not found.`);

	const maxFunctionId = Math.max(sdklib.entries.length - 1, Math.max(...swilibConfig.functions.reserved));
	const swilib = parseSwilibPatch(swilibConfig, fs.readFileSync(file), { target });
	swilib.entries[maxFunctionId] = swilib.entries[maxFunctionId] || undefined;

	return {
		swilibConfig,
		platform,
		ptrlib,
		sdklib,
		swilib
	};
}

export async function loadLibraryForAll(swilibConfig: SwilibConfig) {
	let maxFunctionId = 0;
	const platformToLib = {} as Record<SwiPlatform, Sdklib>;
	const platformToPatterns = {} as Record<SwiPlatform, Array<SwilibPattern | undefined>>;
	for (const platform of getSwilibPlatforms()) {
		platformToLib[platform] = await parseLibraryFromSDK(SDK_DIR, platform);
		platformToPatterns[platform] = parsePatterns(await fs.promises.readFile(`${SDK_DIR}/swilib/patterns/${platform}.ini`));
		maxFunctionId = Math.max(maxFunctionId, platformToLib[platform].entries.length);
	}
	maxFunctionId = Math.max(maxFunctionId, Math.max(...swilibConfig.functions.reserved) + 1);
	return { maxFunctionId, platformToLib, platformToPatterns };
}

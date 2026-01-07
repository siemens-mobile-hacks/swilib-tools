import fs from 'node:fs';
import { getSwilibPatch, SDK_DIR } from "#src/utils.js";
import {
	getSwilibPlatform,
	getSwilibPlatforms,
	loadSwilibConfig,
	parseLibraryFromSDK,
	parsePatterns,
	parseSwilibPatch,
	Sdklib,
	SwilibPattern,
	SwiPlatform
} from "@sie-js/swilib";

export async function loadLibraryForTarget(target: string, file?: string){
	const swilibConfig = loadSwilibConfig(SDK_DIR);
	const platform = getSwilibPlatform(swilibConfig, target);
	const ptrlib = parsePatterns(fs.readFileSync(`${SDK_DIR}/swilib/patterns/${platform}.ini`));
	const sdklib = await parseLibraryFromSDK(SDK_DIR, platform);

	if (!file)
		file = getSwilibPatch(swilibConfig, target);

	if (!file)
		throw new Error(`swilib.vkp not found!`);

	const swilib = parseSwilibPatch(swilibConfig, fs.readFileSync(file), { target });
	swilib.entries[sdklib.entries.length - 1] = swilib.entries[sdklib.entries.length - 1] || undefined;

	return {
		swilibConfig,
		platform,
		ptrlib,
		sdklib,
		swilib
	};
}

export async function loadLibraryForAll() {
	let maxFunctionId = 0;
	const platformToLib = {} as Record<SwiPlatform, Sdklib>;
	const platformToPatterns = {} as Record<SwiPlatform, Array<SwilibPattern | undefined>>;
	for (const platform of getSwilibPlatforms()) {
		platformToLib[platform] = await parseLibraryFromSDK(SDK_DIR, platform);
		platformToPatterns[platform] = parsePatterns(await fs.promises.readFile(`${SDK_DIR}/swilib/patterns/${platform}.ini`));
		maxFunctionId = Math.max(maxFunctionId, platformToLib[platform].entries.length);
	}
	return { maxFunctionId, platformToLib, platformToPatterns };
}

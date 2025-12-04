import fs from 'node:fs';
import { getGhidraSymbols, getIdaSymbols, getPlatformByPhone, swilibConfig, SwiPlatform } from "@sie-js/swilib";
import { getPatchByID } from "../utils.js";
import { getPlatformSwilibFromSDKCached, parseSwilibPatchCached } from "../cache.js";

interface GenSymbolsArgv {
    phone: string;
    file?: string;
    format?: string;
}

export async function genSymbols({ phone, file, format }: GenSymbolsArgv): Promise<void> {
	const platform: SwiPlatform = getPlatformByPhone(phone);
	if (!file && swilibConfig.patches[phone])
		file = getPatchByID(swilibConfig.patches[phone]);

	if (!file) {
		console.error(`File is not specified.`);
		return;
	}

	const swilib = await parseSwilibPatchCached(fs.readFileSync(file));
	const sdklib = await getPlatformSwilibFromSDKCached(platform);

	if (format == 'ida') {
		console.log(getIdaSymbols(platform, sdklib, swilib));
	} else {
		console.log(getGhidraSymbols(platform, sdklib, swilib));
	}
}

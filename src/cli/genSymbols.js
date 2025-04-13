import fs from 'fs';
import { getDataTypesHeader, getGhidraSymbols, getIdaSymbols, getPlatformByPhone, swilibConfig } from "@sie-js/swilib";
import { SDK_DIR, getPatchByID } from "../utils.js";
import { getPlatformSwilibFromSDKCached, parseSwilibPatchCached } from "../cache.js";

export async function genSymbols({ phone, file, format }) {
	let platform;
	if (swilibConfig.platforms.includes(phone)) {
		platform = phone;
	} else {
		platform = getPlatformByPhone(phone);
		if (!file && swilibConfig.patches[phone]) {
			const patchId = swilibConfig.patches[phone];
			file = getPatchByID(patchId);
		}
	}

	if (!file) {
		console.error(`File is not specified.`);
		return;
	}

	const swilib = await parseSwilibPatchCached(fs.readFileSync(file));
	const sdklib = await getPlatformSwilibFromSDKCached(platform);

	if (format == 'ida') {
		console.log(getIdaSymbols(phone, sdklib, swilib));
	} else {
		console.log(getGhidraSymbols(phone, sdklib, swilib));
	}
}

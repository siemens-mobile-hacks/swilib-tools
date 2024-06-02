import fs from 'fs';
import { getPlatformSwilibFromSDK, parseSwilibPatch } from "@sie-js/swilib";
import { getCacheDir, getSdkDir, md5sum } from "./utils.js";
import { simpleGit } from 'simple-git';

const CACHE_DIR = getCacheDir();

export function parseSwilibPatchCached(code) {
	let hash = md5sum(code);
	return withCache(`swilib-${hash}`, () => parseSwilibPatch(code));
}

export async function getPlatformSwilibFromSDKCached(platform) {
	let sdk = getSdkDir();
	let git = simpleGit(sdk);
	let revision = await git.revparse('HEAD');
	return withCache(`sdk-${revision}-${platform}`, () => getPlatformSwilibFromSDK(sdk, platform));
}

export function withCache(key, getValue) {
	let cacheFile = `${CACHE_DIR}/${key}.json`;
	if (fs.existsSync(cacheFile)) {
		try {
			return JSON.parse(fs.readFileSync(cacheFile));
		} catch (e) { /* ignored */ }
	}
	let value = getValue();
	fs.writeFileSync(cacheFile, JSON.stringify(value));
	return value;
}

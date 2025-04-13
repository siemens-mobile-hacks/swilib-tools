import fs from 'fs';
import { getDataTypesHeader, getPlatformSwilibFromSDK, parsePatterns, parseSwilibPatch } from "@sie-js/swilib";
import { SDK_DIR, CACHE_DIR, md5sum } from "./utils.js";
import { simpleGit } from 'simple-git';

export async function getDataTypesHeaderCached(platform) {
	const git = simpleGit(SDK_DIR);
	const revision = await git.revparse('HEAD');
	return withCache(`data-types-${revision}-${platform}`, () => getDataTypesHeader(SDK_DIR, platform));
}

export async function parsePatternsCached(platform) {
	const code = fs.readFileSync(`${SDK_DIR}/swilib/patterns/${platform}.ini`);
	const hash = md5sum(code);
	return withCache(`patterns-${hash}`, () => parsePatterns(code));
}

export async function parseSwilibPatchCached(code) {
	const hash = md5sum(code);
	return withCache(`swilib-${hash}`, () => parseSwilibPatch(code));
}

export async function getPlatformSwilibFromSDKCached(platform) {
	const git = simpleGit(SDK_DIR);
	const revision = await git.revparse('HEAD');
	return withCache(`sdk-${revision}-${platform}`, () => getPlatformSwilibFromSDK(SDK_DIR, platform));
}

export function withCache(key, getValue) {
	const cacheFile = `${CACHE_DIR}/${key}.json`;
	if (fs.existsSync(cacheFile)) {
		try {
			return JSON.parse(fs.readFileSync(cacheFile));
		} catch (e) { /* ignored */ }
	}

	if (!fs.existsSync(CACHE_DIR))
		fs.mkdirSync(CACHE_DIR, { recursive: true });

	const value = getValue();
	fs.writeFileSync(cacheFile, JSON.stringify(value));
	return value;
}

export function getLastCacheTime() {
	if (fs.existsSync(`${CACHE_DIR}/.timestamp`))
		return +fs.readFileSync(`${CACHE_DIR}/.timestamp`).toString();
	return 0;
}

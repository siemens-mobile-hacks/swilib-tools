import fs from 'node:fs';
import {
	getDataTypesHeader,
	getPlatformSwilibFromSDK,
	parsePatterns,
	parseSwilibPatch, SdkEntry, Swilib, SwilibPattern,
	SwiPlatform
} from "@sie-js/swilib";
import { simpleGit } from 'simple-git';
import { SDK_DIR, CACHE_DIR, md5sum } from "./utils.js";

export async function getDataTypesHeaderCached(platform: SwiPlatform): Promise<string> {
	const git = simpleGit(SDK_DIR);
	const revision = await git.revparse('HEAD');
	return withCache(`data-types-${revision}-${platform}`, () => getDataTypesHeader(SDK_DIR, platform));
}

export async function parsePatternsCached(platform: SwiPlatform): Promise<SwilibPattern[]> {
	const code = fs.readFileSync(`${SDK_DIR}/swilib/patterns/${platform}.ini`);
	const hash = md5sum(code);
	return withCache(`patterns-${hash}`, () => parsePatterns(code));
}

export async function parseSwilibPatchCached(code: Buffer): Promise<Swilib> {
	const hash = md5sum(code);
	return withCache(`swilib-${hash}`, () => parseSwilibPatch(code));
}

export async function getPlatformSwilibFromSDKCached(platform: SwiPlatform): Promise<SdkEntry[]> {
	const git = simpleGit(SDK_DIR);
	const revision = await git.revparse('HEAD');
	return withCache(`sdk-${revision}-${platform}`, () => getPlatformSwilibFromSDK(SDK_DIR, platform));
}

export function withCache<T>(key: string, getValue: () => T): T {
	const cacheFile = `${CACHE_DIR}/${key}.json`;
	if (fs.existsSync(cacheFile)) {
		try {
			return JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as T;
		} catch (e) { /* ignored */ }
	}

	if (!fs.existsSync(CACHE_DIR))
		fs.mkdirSync(CACHE_DIR, { recursive: true });

	const value = getValue();
	fs.writeFileSync(cacheFile, JSON.stringify(value));
	return value;
}

export function getLastCacheTime(): number {
	if (fs.existsSync(`${CACHE_DIR}/.timestamp`))
		return +fs.readFileSync(`${CACHE_DIR}/.timestamp`).toString();
	return 0;
}

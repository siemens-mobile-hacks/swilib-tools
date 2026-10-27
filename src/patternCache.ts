import { createHash } from "node:crypto";
import os from "node:os";
import { SwilibPattern } from "@sie-js/swilib";
import { findPatterns } from "#src/utils/ptr89.js";
import { persistCached } from "#src/utils/cache.js";
import { FULLFLASHES_DIR, getFullflash, parseSwilibTarget } from "#src/utils/sdk.js";

const CACHE_VERSION = 3;

export interface SwilibPatternCacheEntry {
	address?: number;
	error?: string;
}

export type SwilibPatternCache = Array<SwilibPatternCacheEntry | null | undefined>;

export function loadSwilibPatternCache(
	target: string,
	patterns: Array<SwilibPattern | undefined>,
	fullflash?: string,
): Promise<SwilibPatternCache> {
	return persistCached(`${target}.patterns`, getRevision(patterns), async () => {
		const parsedTarget = parseSwilibTarget(target);
		const source = fullflash ?? (parsedTarget && getFullflash(parsedTarget.model, parsedTarget.sw));
		if (!source)
			throw new Error(`Fullflash not found. Clone https://git.siepatch.dev/siepatch/stripped-fullflashes.git to ${FULLFLASHES_DIR}.`);

		const cache: SwilibPatternCache = [];
		const groups = new Map<string, { candidates: string[]; ids: number[] }>();
		for (let id = 0; id < patterns.length; id++) {
			const pattern = patterns[id]?.pattern;
			if (!pattern)
				continue;
			const candidates = typeof pattern === 'string' ? [pattern] : pattern;
			const key = JSON.stringify(candidates);
			const group = groups.get(key) ?? { candidates, ids: [] };
			group.ids.push(id);
			groups.set(key, group);
		}

		const results = await searchPatterns(source, [...new Set([...groups.values()].flatMap(group => group.candidates))]);
		for (const { candidates, ids } of groups.values()) {
			let entry: SwilibPatternCacheEntry = {};
			for (const pattern of candidates) {
				const result = results.get(pattern)!;
				if (result.error || result.address !== undefined) {
					entry = result;
					break;
				}
			}
			for (const id of ids)
				cache[id] = entry;
		}
		return cache;
	});
}

function getRevision(patterns: Array<SwilibPattern | undefined>): string {
	const values = patterns.map(entry => entry?.pattern ?? null);
	const hash = createHash('sha256').update(JSON.stringify(values)).digest('hex');
	return `${CACHE_VERSION}:${hash}`;
}

async function searchPatterns(source: string, patterns: string[]): Promise<Map<string, SwilibPatternCacheEntry>> {
	const results = new Map<string, SwilibPatternCacheEntry>();
	const concurrency = Math.max(1, Math.min(4, Math.floor(os.availableParallelism() / 2)));
	const chunkSize = Math.ceil(patterns.length / concurrency);
	const chunks: string[][] = [];
	for (let i = 0; i < patterns.length; i += chunkSize)
		chunks.push(patterns.slice(i, i + chunkSize));

	await Promise.all(chunks.map(async chunk => {
		try {
			const found = await findPatterns(source, chunk);
			chunk.forEach((pattern, i) => results.set(pattern, { address: found[i].address }));
		} catch {
			// One invalid pattern fails the whole batch, so retry one by one
			for (const pattern of chunk)
				results.set(pattern, await searchPattern(source, pattern));
		}
	}));
	return results;
}

async function searchPattern(source: string, pattern: string): Promise<SwilibPatternCacheEntry> {
	try {
		const [{ address }] = await findPatterns(source, [pattern]);
		return { address };
	} catch (error) {
		if (!(error instanceof Error))
			throw error;
		return { error: error.message };
	}
}

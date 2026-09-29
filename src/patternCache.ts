import path from "node:path";
import { createHash } from "node:crypto";
import { SwilibPattern, SwiPlatform } from "@sie-js/swilib";
import { Ptr89Cli, Ptr89PatternError, Ptr89Search } from "#src/utils/ptr89.js";
import { getPersistCached, persistCached } from "#src/utils/cache.js";

export const PATTERN_CACHE_VERSION = 2;
const MAX_CONCURRENCY = 4;

export interface SwilibPatternCacheEntry {
	name?: string;
	symbol?: string;
	pattern: string;
	type?: string;
	address?: number;
	error?: string;
}

export interface SwilibPatternCache {
	version: typeof PATTERN_CACHE_VERSION;
	target: string;
	platform: SwiPlatform;
	fullflash: string;
	ptr89: string;
	patternsHash: string;
	entries: Record<string, SwilibPatternCacheEntry>;
}

export async function generateSwilibPatternCache(
	target: string,
	platform: SwiPlatform,
	patterns: Array<SwilibPattern | undefined>,
	fullflash: string,
): Promise<SwilibPatternCache> {
	const ptr89 = new Ptr89Cli();
	const ptr89Version = await ptr89.getVersion();
	const entries: Record<string, SwilibPatternCacheEntry> = {};
	const idsByPattern = new Map<string, number[]>();

	for (let id = 0; id < patterns.length; id++) {
		const pattern = patterns[id]?.pattern;
		if (!pattern)
			continue;
		const ids = idsByPattern.get(pattern) ?? [];
		ids.push(id);
		idsByPattern.set(pattern, ids);
	}

	await mapConcurrent([...idsByPattern], MAX_CONCURRENCY, async ([pattern, ids]) => {
		let search: Ptr89Search | undefined;
		let error: string | undefined;
		try {
			search = await ptr89.find(fullflash, pattern, 1);
		} catch (cause) {
			if (!(cause instanceof Ptr89PatternError))
				throw cause;
			error = cause.message;
		}

		const address = search?.results[0]?.address;
		for (const id of ids) {
			const entry = patterns[id]!;
			entries[formatId(id)] = {
				name: entry.name,
				symbol: entry.symbol,
				pattern,
				type: search?.type,
				address,
				error,
			};
		}
	});

	return {
		version: PATTERN_CACHE_VERSION,
		target,
		platform,
		fullflash: path.basename(fullflash),
		ptr89: ptr89Version,
		patternsHash: getPatternsHash(patterns),
		entries: sortEntries(entries),
	};
}

export function getPatternsHash(patterns: Array<SwilibPattern | undefined>): string {
	const resolvedPatterns = patterns.map(entry => entry?.pattern ?? null);
	return createHash('sha256').update(JSON.stringify(resolvedPatterns)).digest('hex');
}

export async function loadSwilibPatternCache(
	target: string,
	patterns: Array<SwilibPattern | undefined>,
): Promise<SwilibPatternCache | undefined> {
	const cache = await getPersistCached<SwilibPatternCache>(getPatternCacheKey(target), getPatternCacheRevision(patterns));
	if (!cache)
		return undefined;
	if (cache.version !== PATTERN_CACHE_VERSION)
		throw new Error(`Unsupported pattern cache version for ${target}: ${cache.version}.`);
	if (!cache.entries || typeof cache.entries !== 'object')
		throw new Error(`Invalid pattern cache for ${target}.`);
	return cache;
}

export async function persistSwilibPatternCache(
	target: string,
	platform: SwiPlatform,
	patterns: Array<SwilibPattern | undefined>,
	fullflash: string,
): Promise<SwilibPatternCache> {
	return persistCached(
		getPatternCacheKey(target),
		getPatternCacheRevision(patterns),
		() => generateSwilibPatternCache(target, platform, patterns, fullflash),
	);
}

function getPatternCacheKey(target: string): string {
	return `${target}.patterns`;
}

function getPatternCacheRevision(patterns: Array<SwilibPattern | undefined>): string {
	return `${PATTERN_CACHE_VERSION}:${getPatternsHash(patterns)}`;
}

async function mapConcurrent<T>(items: T[], concurrency: number, handler: (item: T) => Promise<void>): Promise<void> {
	let nextIndex = 0;
	const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
		while (nextIndex < items.length)
			await handler(items[nextIndex++]);
	});
	await Promise.all(workers);
}

function sortEntries(entries: Record<string, SwilibPatternCacheEntry>): Record<string, SwilibPatternCacheEntry> {
	return Object.fromEntries(Object.entries(entries).sort(([left], [right]) => parseInt(left, 16) - parseInt(right, 16)));
}

function formatId(id: number): string {
	return id.toString(16).padStart(3, '0').toUpperCase();
}

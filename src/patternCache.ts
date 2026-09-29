import { createHash } from "node:crypto";
import { SwilibPattern } from "@sie-js/swilib";
import { findPattern } from "#src/utils/ptr89.js";
import { getPersistCached, persistCached } from "#src/utils/cache.js";

const CACHE_VERSION = 3;

export interface SwilibPatternCacheEntry {
	address?: number;
	error?: string;
}

export type SwilibPatternCache = Array<SwilibPatternCacheEntry | null | undefined>;

export function loadSwilibPatternCache(
	target: string,
	patterns: Array<SwilibPattern | undefined>,
): Promise<SwilibPatternCache | undefined> {
	return getPersistCached(`${target}.patterns`, getRevision(patterns));
}

export function persistSwilibPatternCache(
	target: string,
	patterns: Array<SwilibPattern | undefined>,
	fullflash: string,
): Promise<SwilibPatternCache> {
	return persistCached(`${target}.patterns`, getRevision(patterns), async () => {
		const cache: SwilibPatternCache = [];
		const idsByPattern = new Map<string, number[]>();
		for (let id = 0; id < patterns.length; id++) {
			const pattern = patterns[id]?.pattern;
			if (!pattern)
				continue;
			idsByPattern.set(pattern, [...idsByPattern.get(pattern) ?? [], id]);
		}

		await mapConcurrent([...idsByPattern], async ([pattern, ids]) => {
			let entry: SwilibPatternCacheEntry;
			try {
				const { address } = await findPattern(fullflash, pattern);
				entry = { address };
			} catch (error) {
				if (!(error instanceof Error))
					throw error;
				entry = { error: error.message };
			}
			for (const id of ids)
				cache[id] = entry;
		});
		return cache;
	});
}

function getRevision(patterns: Array<SwilibPattern | undefined>): string {
	const values = patterns.map(entry => entry?.pattern ?? null);
	const hash = createHash('sha256').update(JSON.stringify(values)).digest('hex');
	return `${CACHE_VERSION}:${hash}`;
}

async function mapConcurrent<T>(items: T[], handler: (item: T) => Promise<void>): Promise<void> {
	let index = 0;
	const workers = Array.from({ length: Math.min(4, items.length) }, async () => {
		while (index < items.length)
			await handler(items[index++]);
	});
	await Promise.all(workers);
}

import { createHash } from "node:crypto";
import { SwilibPattern } from "@sie-js/swilib";
import { findPattern } from "#src/utils/ptr89.js";
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

		await mapConcurrent([...groups.values()], async ({ candidates, ids }) => {
			let entry: SwilibPatternCacheEntry;
			try {
				entry = {};
				for (const pattern of candidates) {
					const { address } = await findPattern(source, pattern);
					if (address !== undefined) {
						entry = { address };
						break;
					}
				}
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

import { getDevRootRevision } from "#src/utils/sdk.js";

interface CacheEntry {
	revision: string;
	value: any;
}

const cache = new Map<string, CacheEntry>();

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const revision = await getDevRootRevision();
	if (cache.has(key)) {
		const entry = cache.get(key)!;
		if (entry.revision === revision)
			return entry.value;
		cache.delete(key);
	}
	const value = await fn();
	cache.set(key, { revision, value });
	return value;
}

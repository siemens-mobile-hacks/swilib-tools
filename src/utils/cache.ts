import fs from "node:fs";
import { CACHE_DIR, getDevRootRevision } from "#src/utils/sdk.js";

interface CacheEntry<T = unknown> {
	revision: string;
	value: T;
}

const cache = new Map<string, CacheEntry>();

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
	const revision = `${await getDevRootRevision()}-${getPersistentCacheRevision()}`;
	const entry = cache.get(key) as CacheEntry<T> | undefined;
	if (entry?.revision === revision)
		return entry.value;

	const value = await fn();
	cache.set(key, { revision, value });
	return value;
}

export async function persistCached<T>(key: string, revision: string, fn: () => Promise<T>): Promise<T> {
	const entry = await readPersistCached<T>(key);
	if (entry?.revision === revision)
		return entry.value;

	const value = await fn();
	await writePersistCache(key, { revision, value });
	return value;
}

export async function getPersistCached<T>(key: string, revision: string): Promise<T | undefined> {
	const entry = await readPersistCached<T>(key);
	return entry?.revision === revision ? entry.value : undefined;
}

function getPersistCacheFile(key: string): string {
	if (!/^[A-Za-z0-9._-]+$/.test(key))
		throw new Error(`Invalid persistent cache key: ${key}`);
	return `${CACHE_DIR}/${key}.json`;
}

async function readPersistCached<T>(key: string): Promise<CacheEntry<T> | undefined> {
	try {
		return JSON.parse(await fs.promises.readFile(getPersistCacheFile(key), 'utf8')) as CacheEntry<T>;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT' || error instanceof SyntaxError)
			return undefined;
		throw error;
	}
}

async function writePersistCache<T>(key: string, entry: CacheEntry<T>): Promise<void> {
	await fs.promises.mkdir(CACHE_DIR, { recursive: true });
	await fs.promises.writeFile(getPersistCacheFile(key), JSON.stringify(entry, null, '\t') + '\n');
}

function getPersistentCacheRevision(): string {
	if (!CACHE_DIR || !fs.existsSync(CACHE_DIR))
		return 'empty';
	return fs.readdirSync(CACHE_DIR)
		.map(name => {
			const stat = fs.statSync(`${CACHE_DIR}/${name}`);
			return `${name}:${stat.size}:${stat.mtimeMs}`;
		})
		.sort()
		.join('|');
}

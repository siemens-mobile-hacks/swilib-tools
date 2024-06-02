#!/usr/bin/env node
import fs from 'fs';
import swilibConfig from '../config.js';
import { getPatchByID, SDK_DIR, PATCHES_CACHE_DIR } from '../utils.js';
import { getPlatformSwilibFromSDKCached, parseSwilibPatchCached } from '../cache.js';
import { simpleGit } from 'simple-git';

export async function updateCacheCmd(argv) {
	dropCaches();
	await downloadPatches();
	await syncGitRepos();
	await precacheAll();
	console.log(`done.`);
	return 0;
}

async function precacheAll() {
	console.log(`Precache swilib's...`);
	for (let phone in swilibConfig.patches) {
		let patchId = swilibConfig.patches[phone];
		parseSwilibPatchCached(fs.readFileSync(getPatchByID(patchId)));
	}

	console.log(`Precache SDK...`);
	for (let platform of swilibConfig.platforms) {
		getPlatformSwilibFromSDKCached(platform);
	}
}

async function syncGitRepos() {
	for (let repo of [SDK_DIR, PATCHES_DIR]) {
		let git = simpleGit(repo);
		let isClean = (await git.status({'untracked-file': 'no'})).isClean();
		if (!isClean) {
			console.error(`[error] Git working directory not clean: ${repi}`);
			continue;
		}
		console.log(`[git] sync ${repo}`);
		await git.pull(repo);
		let rev = await git.revparse('HEAD');
		console.log(`rev: ${rev}`);
	}
}

async function downloadPatches() {
	console.log(`Fetching all swilib's....`);
	fs.mkdirSync(PATCHES_CACHE_DIR, { recursive: true });

	let promises = [];
	for (let phone in swilibConfig.patches) {
		let patchId = swilibConfig.patches[phone];
		promises.push(fetchPatch(patchId));
	}

	let patches = await Promise.all(promises);
	for (let patch of patches) {
		console.log(` + ${patch.id}.vkp`);
		fs.writeFileSync(`${PATCHES_CACHE_DIR}/${patch.id}.vkp`, Buffer.from(patch.data));
	}
}

async function fetchPatch(patchId) {
	let req = await fetch(`https://patches.kibab.com/patches/dn.php5?id=${patchId}&no_counter=1`);
	return {
		id: patchId,
		data: await req.arrayBuffer()
	};
}

function dropCaches() {
	console.log(`Clean all caches...`);
	let cacheDir = getCacheDir();
	if (fs.existsSync(cacheDir))
		fs.rmSync(cacheDir, { recursive: true });
}

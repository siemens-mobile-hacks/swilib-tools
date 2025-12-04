import fs from 'node:fs';
import { getPatchByID, PATCHES_DIR, SDK_DIR, CACHE_DIR } from '../utils.js';
import { getPlatformSwilibFromSDKCached, parsePatternsCached, parseSwilibPatchCached } from '../cache.js';
import { simpleGit } from 'simple-git';
import { swilibConfig } from '@sie-js/swilib';

export async function updateCacheCmd(): Promise<number> {
	dropCaches();
	await syncGitRepos();
	await precacheAll();
	fs.writeFileSync(`${CACHE_DIR}/.timestamp`, Date.now().toString());
	console.log(`done.`);
	return 0;
}

async function precacheAll(): Promise<void> {
	console.log(`Precache swilib's...`);
	for (let phone in swilibConfig.patches) {
		const patchId = swilibConfig.patches[phone];
		const patchFile = getPatchByID(patchId);
		if (patchFile) {
			await parseSwilibPatchCached(fs.readFileSync(patchFile));
		}
	}

	console.log(`Precache SDK & patterns...`);
	for (let platform of swilibConfig.platforms) {
		await getPlatformSwilibFromSDKCached(platform);
		await parsePatternsCached(platform);
	}
}

async function syncGitRepos(): Promise<void> {
	for (let repo of [SDK_DIR, PATCHES_DIR]) {
		const git = simpleGit(repo);
		git.outputHandler((command, stdout, stderr) => {
			stdout.pipe(process.stdout);
			stderr.pipe(process.stderr);
			console.log();
		});
		try {
			await git.pull(repo);
		} catch (e) {
			console.log(`GIT pull error for repo ${repo}`);
		}
	}
	console.log();
}

function dropCaches(): void {
	console.log(`Clean all caches...`);
	if (fs.existsSync(CACHE_DIR))
		fs.rmSync(CACHE_DIR, { recursive: true });
}

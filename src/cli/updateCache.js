import fs from 'fs';
import { getPatchByID, PATCHES_DIR, SDK_DIR, CACHE_DIR } from '../utils.js';
import { getPlatformSwilibFromSDKCached, parseSwilibPatchCached } from '../cache.js';
import { simpleGit } from 'simple-git';
import { swilibConfig } from '@sie-js/swilib';

export async function updateCacheCmd(argv) {
	dropCaches();
	await syncGitRepos();
	await precacheAll();
	fs.writeFileSync(`${CACHE_DIR}/.timestamp`, Date.now().toString());
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
		git.outputHandler((command, stdout, stderr) => {
			stdout.pipe(process.stdout);
			stderr.pipe(process.stderr);
			console.log();
		});
		let isClean = (await git.status({'untracked-file': 'no'})).isClean();
		if (!isClean) {
			console.error(`[error] Git working directory not clean: ${repi}`);
			continue;
		}
		await git.pull(repo);
	}
	console.log();
}

function dropCaches() {
	console.log(`Clean all caches...`);
	if (fs.existsSync(CACHE_DIR))
		fs.rmSync(CACHE_DIR, { recursive: true });
}

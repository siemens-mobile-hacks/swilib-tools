import fs from "node:fs";
import chalk from "chalk";
import { simpleGit } from "simple-git";
import { getSwilibPlatform, loadSwilibConfig, parsePatterns } from "@sie-js/swilib";
import { CLIBaseOptions } from "#src/cli.js";
import { createAppCommand } from "#src/utils/command.js";
import {
	getFullflash,
	parseSwilibTarget,
	FULLFLASHES_DIR,
	PATCHES_DIR,
	SDK_DIR
} from "#src/utils/sdk.js";
import { persistSwilibPatternCache } from "#src/patternCache.js";

export default createAppCommand<CLIBaseOptions>(async () => {
	for (const repo of [SDK_DIR, PATCHES_DIR, FULLFLASHES_DIR]) {
		console.log(`Updating ${repo}...`);
		const git = simpleGit(repo);
		git.outputHandler((_cmd, stdout, stderr, _args) => {
			stdout.pipe(process.stdout);
			stderr.pipe(process.stderr);
		});
		await git.pull();
	}
	const swilibConfig = loadSwilibConfig(SDK_DIR);
	const patternSource = await fs.promises.readFile(`${SDK_DIR}/swilib/patterns.toml`);
	for (const target of swilibConfig.targets) {
		const parsedTarget = parseSwilibTarget(target);
		const fullflash = parsedTarget && getFullflash(parsedTarget.model, parsedTarget.sw);
		if (!fullflash) {
			console.log(chalk.yellow(`${target}: fullflash not found, pattern cache skipped.`));
			continue;
		}

		const platform = getSwilibPlatform(swilibConfig, target);
		const patterns = parsePatterns(patternSource, platform);
		console.log(`${target}: updating pattern cache (${platform})...`);
		const cache = await persistSwilibPatternCache(target, platform, patterns, fullflash);
		console.log(chalk.green(`${target}: ${Object.keys(cache.entries).length} patterns cached.`));
	}
});

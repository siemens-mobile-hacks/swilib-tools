import { CLIBaseOptions } from "#src/cli.js";
import { createAppCommand } from "#src/utils/command.js";
import { simpleGit } from "simple-git";
import { PATCHES_DIR, SDK_DIR } from "#src/utils/sdk.js";

export default createAppCommand<CLIBaseOptions>(async () => {
	for (const repo of [SDK_DIR, PATCHES_DIR]) {
		console.log(`Updating ${repo}...`);
		const git = simpleGit(repo);
		git.outputHandler((cmd, stdout, stderr, args) => {
			stdout.pipe(process.stdout);
			stderr.pipe(process.stderr);
		});
		await git.pull();
	}
});

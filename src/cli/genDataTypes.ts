import fs from 'node:fs';
import { CLIBaseOptions } from "#src/cli.js";
import { createAppCommand } from "#src/utils/command.js";
import { getDataTypesHeader, getSwilibPlatform, loadSwilibConfig } from "@sie-js/swilib";
import { SDK_DIR } from "#src/utils/sdk.js";

interface Options extends CLIBaseOptions {
	target: string;
	output?: string;
}

export default createAppCommand<Options>(async ({ output, target }) => {
	const swilibConfig = loadSwilibConfig(SDK_DIR);
	const platform = getSwilibPlatform(swilibConfig, target);
	const header = await getDataTypesHeader(SDK_DIR, platform);

	if (output == "-" || !output) {
		process.stdout.write(header);
	} else {
		fs.writeFileSync(output, header);
	}
});

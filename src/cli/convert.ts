import fs from 'node:fs';
import { CLIBaseOptions } from "#src/cli.js";
import { createAppCommand } from "#src/utils/command.js";
import { loadLibraryForTarget } from "#src/utils/swilib.js";
import { getGhidraSymbols, getIdaSymbols, getSwiBlib, serializeSwilib } from "@sie-js/swilib";

interface Options extends CLIBaseOptions {
	target: string;
	file?: string;
	output: string;
	format: string;
}

export default createAppCommand<Options>(async ({ target, file, format, output }) => {
	const { swilibConfig, sdklib, swilib } = await loadLibraryForTarget(target, { file });

	const generate = () => {
		switch (format) {
			case 'blib':
				return getSwiBlib(swilib);

			case 'vkp':
				return serializeSwilib(swilibConfig, swilib, sdklib);

			case 'idc':
				return getIdaSymbols(swilibConfig, swilib, sdklib);

			case 'txt':
				return getGhidraSymbols(swilibConfig, swilib, sdklib);

			default:
				throw new Error(`Unknown format: ${format}`);
		}
	};

	if (output == "-" || !output) {
		process.stdout.write(generate());
	} else {
		fs.writeFileSync(output, generate());
	}
});

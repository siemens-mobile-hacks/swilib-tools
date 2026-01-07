#!/usr/bin/env node
import { program } from "commander";
import { getVersion } from "#src/utils/version.js";
import cmdServer from "./cli/server.js";
import cmdCheckSwilib from "#src/cli/checkSwilib.js";
import cmdMergeSwilibs from "#src/cli/mergeSwilib.js";
import cmdConvert from "#src/cli/convert.js";
import cmdGenAsmSymbols from "#src/cli/genAsmSymbols.js";
import cmdGenSimulatorApi from "#src/cli/genSimulatorApi.js";
import { findDefaultDevRoot, setDevRoot } from "#src/utils/sdk.js";

export interface CLIBaseOptions {
	root?: string;
}

const defaultDevRoot = findDefaultDevRoot() ?? process.env.SIE_DEV_ROOT;

program
	.name("swilib-tools")
	.version(getVersion(), '-v, --version')
	.requiredOption('-R, --root', 'path to the root directory with the SDK and other repos', defaultDevRoot)
	.description('CLI tool for Siemens Mobile phone development.')
	.hook('preAction', (cmd) => {
		if (cmd.opts().root)
			setDevRoot(cmd.opts().root);
	});

program
	.command('server')
	.description('API for web frontend')
	.option('-l, --listen [ADDR]', 'Listen address', '127.0.0.1')
	.option('-p, --port [PORT]', 'Listen port', '31000')
	.action(cmdServer);

program
	.command('check')
	.description('Check swilib.vkp for errors')
	.requiredOption('-t, --target <TARGET>', 'Phone target (e.g. EL71v45 or ELKA)')
	.option('-f, --file [FILE]', 'Path to swilib.vkp file')
	.action(cmdCheckSwilib);

program
	.command('merge')
	.description('Merge two swilib.vkp files (source.vkp → destination.vkp)')
	.requiredOption('-t, --target <TARGET>', 'Phone target (e.g. EL71v45 or ELKA)')
	.requiredOption('-s, --source <FILE>', 'Source swilib.vkp file')
	.requiredOption('-d, --destination <FILE>', 'Destination swilib.vkp file')
	.requiredOption('-o, --output <FILE>', 'Output file')
	.action(cmdMergeSwilibs);

program
	.command('convert')
	.description("Convert swilib to other formats")
	.addHelpText("before", [
		'Available formats:',
		'  txt - Ghidra SRE symbols',
		'  idc - IDA Pro symbols',
		'  blib - Siemens binary library',
		'  vkp - V-Klay patch (formatted)',
		'',
	].join("\n"))
	.requiredOption('-t, --target <TARGET>', 'Phone target (e.g. EL71v45 or ELKA)')
	.option('-f, --file [FILE]', 'Path to swilib.vkp file')
	.option('-F, --format [FORMAT]', 'Output format (valid formats: txt, idc, blib, vkp)', 'txt')
	.option('-o, --output [DIR]', 'Output directory')
	.action(cmdConvert);

program
	.command('gen-asm-symbols')
	.description('Generate assembler symbols for the SDK')
	.requiredOption('-o, --output <DIR>', 'Path to the SDK directory')
	.action(cmdGenAsmSymbols);

program
	.command('gen-simulator-api')
	.description('Generate API stubs for the ELF emulator')
	.requiredOption('-o, --output <DIR>', 'Path to the emulator directory')
	.action(cmdGenSimulatorApi);

program.showSuggestionAfterError(true);
program.showHelpAfterError();
program.parse();

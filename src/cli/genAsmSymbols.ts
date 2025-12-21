import fs from 'node:fs';
import path from 'node:path';
import { sprintf } from 'sprintf-js';
import { CLIBaseOptions } from "#src/cli.js";
import { createAppCommand } from "#src/utils/command.js";
import { SDK_DIR } from "#src/utils.js";
import { loadLibraryForTarget } from "#src/utils/swilib.js";
import { analyzeSwilib, getSwilibPlatforms, loadSwilibConfig, SwiValueType } from "@sie-js/swilib";

interface Options extends CLIBaseOptions {
	output: string;
}

export default createAppCommand<Options>(async ({ output }) => {
	const symbols: Record<string, string[]> = {};
	const values: Record<string, string[]> = {};
	const swilibStubs: Record<string, Record<string, Record<string, string>>> = {};

	const swilibConfig = loadSwilibConfig(SDK_DIR);
	for (const target of swilibConfig.targets) {
		const { sdklib, swilib, platform } = await loadLibraryForTarget(target);

		const analysis = analyzeSwilib(swilibConfig, swilib, sdklib);

		symbols[target] = symbols[target] ?? [];
		values[target] = values[target] ?? [];

		for (let id = 0; id < sdklib.entries.length; id++) {
			const swiEntry = swilib.entries[id];
			const sdkEntry = sdklib.entries[id];

			if (!sdkEntry)
				continue;

			const isInvalid = !swiEntry || analysis.errors[id] || swiEntry.value == SwiValueType.UNDEFINED;
			if (isInvalid) {
				values[target].push([
					`#define SWI_${sprintf("%04X", id)}`,
					`___bad_swi_addr___(${sprintf("0x%08X", 0xFFFFFFFF)})`
				].join(" "));
			} else {
				values[target].push([
					`#define SWI_${sprintf("%04X", id)}`,
					`${sprintf("0x%08X", swiEntry.value)}`
				].join(" "));
			}

			for (const func of sdkEntry.functions) {
				swilibStubs[func.file] = swilibStubs[func.file] ?? {};
				swilibStubs[func.file][func.symbol] = swilibStubs[func.file][func.symbol] ?? {};
				swilibStubs[func.file][func.symbol][platform] = [
					`#define ${func.symbol}(...)`,
					`((__typeof__(&${func.symbol}))`,
					`SWI_${sprintf("%04X", id)})(__VA_ARGS__)`
				].join(" ");

				if (!isInvalid) {
					symbols[target].push([
						`.global ${func.symbol}`,
						`.equ ${func.symbol}, ${sprintf("0x%08X", swiEntry.value)}`,
						`.type ${func.symbol}, function`
					].join("\n"));
				}
			}

			for (const func of sdkEntry.pointers) {
				swilibStubs[func.file] = swilibStubs[func.file] ?? {};
				swilibStubs[func.file][func.symbol] = swilibStubs[func.file][func.symbol] || {};
				swilibStubs[func.file][func.symbol][platform] = [
					`#define ${func.symbol}()`,
					`((__typeof__(${func.symbol}()))`,
					`SWI_${sprintf("%04X", id)})`
				].join(" ");

				if (!isInvalid) {
					symbols[target].push([
						`.equ ${func.symbol}_VALUE, ${sprintf("0x%08X", swiEntry.value)}`,
					].join("\n"));
				}
			}
		}
	}

	if (!fs.existsSync(`${output}/gen`))
		fs.mkdirSync(`${output}/gen`);

	const swilibS: string[] = [];
	for (const target of swilibConfig.targets) {
		swilibS.push([
			`#ifdef ${target}`,
			`\t#include "gen/${target}.S"`,
			`#endif`
		].join("\n"));
	}
	console.log(`-> ${output}/swilib.S`);
	fs.writeFileSync(
		`${output}/swilib.S`,
		`@ Code generated. DO NOT EDIT!\n` + swilibS.join("\n\n") + "\n"
	);

	const swilibValuesH: string[] = [];
	for (const target of swilibConfig.targets) {
		swilibValuesH.push([
			`#ifdef ${target}`,
			`\t#include "gen/${target}.h"`,
			`#endif`
		].join("\n"));
	}
	console.log(`-> ${output}/swilib-values.h`);
	fs.writeFileSync(
		`${output}/swilib-values.h`,
		`#pragma once\n// Code generated. DO NOT EDIT!\n` + swilibValuesH.join("\n\n") + "\n"
	);

	for (const target in symbols) {
		const fileS = `${output}/gen/${target}.S`;
		console.log(`-> ${fileS}`);
		fs.writeFileSync(fileS, `@ Code generated. DO NOT EDIT!\n` + symbols[target].join("\n\n") + "\n");

		const fileH = `${output}/gen/${target}.h`;
		console.log(`-> ${fileH}`);
		fs.writeFileSync(fileH, `#pragma once\n// Code generated. DO NOT EDIT!\n` + values[target].join("\n\n") + "\n");
	}

	for (const file in swilibStubs) {
		const headerPath = `${output}/${file}`;
		const headerDir = path.dirname(headerPath);

		if (!fs.existsSync(headerDir))
			fs.mkdirSync(headerDir, { recursive: true });

		let code = [
			`#pragma once`,
			`#include_next <${file}>`,
			`// Code generated. DO NOT EDIT!`,
		];

		for (const symbol in swilibStubs[file]) {
			const platforms = Object.keys(swilibStubs[file][symbol]);
			const allPlatforms = (
				platforms.length == getSwilibPlatforms().length &&
				Object.values(swilibStubs[file][symbol]).every((v) => v == swilibStubs[file][symbol][platforms[0]])
			);

			if (allPlatforms) {
				code.push(swilibStubs[file][symbol][platforms[0]]);
			} else {
				for (const platform of platforms) {
					code.push(`#ifdef ${platform}`);
					code.push(swilibStubs[file][symbol][platform]);
					code.push(`#endif`);
				}
			}
		}

		console.log(`-> ${headerPath}`);
		fs.writeFileSync(`${headerPath}`, code.join("\n") + "\n");
	}
});

import fs from 'node:fs';
import path from 'node:path';
import { sprintf } from 'sprintf-js';
import {
	analyzeSwilib,
	getPlatformByPhone,
	getPlatformSwilibFromSDK,
	swilibConfig,
	SwiValueType
} from "@sie-js/swilib";
import { getPatchByID, SDK_DIR } from "../utils.js";
import { parseSwilibPatchCached } from "../cache.js";

type GenAsmSymbolsArgv = {
	dir: string;
};

export async function genAsmSymbols({ dir }: GenAsmSymbolsArgv): Promise<void> {
	let symbols: Record<string, string[]> = {};
	let values: Record<string, string[]> = {};
	let swilibStubs: Record<string, Record<string, Record<string, string>>> = {};

	for (const phone of swilibConfig.phones) {
		const patchId = swilibConfig.patches[phone];
		const file = getPatchByID(patchId);
		if (!file) {
			console.error(`Patch file not found for phone ${phone}`);
			continue;
		}

		const swilib = await parseSwilibPatchCached(fs.readFileSync(file));
		const platform = getPlatformByPhone(phone);
		const sdklib = getPlatformSwilibFromSDK(SDK_DIR, platform);

		const analysis = analyzeSwilib(platform, sdklib, swilib);

		symbols[phone] = symbols[phone] || [];
		values[phone] = values[phone] || [];

		for (let id = 0; id < sdklib.length; id++) {
			const entry = swilib.entries[id];
			if (!sdklib[id])
				continue;

			const isInvalid = !entry || (id.toString() in analysis.errors) || entry.value == SwiValueType.UNDEFINED;
			if (isInvalid) {
				values[phone].push(`#define SWI_${sprintf("%04X", id)} ___bad_swi_addr___(${sprintf("0x%08X", 0xFFFFFFFF)})`);
			} else {
				values[phone].push(`#define SWI_${sprintf("%04X", id)} ${sprintf("0x%08X", entry.value)}`);
			}

			const sdkEntry = sdklib[id];
			for (const func of sdkEntry.functions) {
				swilibStubs[func.file] = swilibStubs[func.file] || {};
				swilibStubs[func.file][func.symbol] = swilibStubs[func.file][func.symbol] || {};
				swilibStubs[func.file][func.symbol][platform] = `#define ${func.symbol}(...) ((__typeof__(&${func.symbol})) SWI_${sprintf("%04X", id)})(__VA_ARGS__)`;

				if (!isInvalid) {
					symbols[phone].push([
						`.global ${func.symbol}`,
						`.equ ${func.symbol}, ${sprintf("0x%08X", entry.value)}`,
						`.type ${func.symbol}, function`
					].join("\n"));
				}
			}

			for (const func of sdkEntry.pointers) {
				swilibStubs[func.file] = swilibStubs[func.file] || {};
				swilibStubs[func.file][func.symbol] = swilibStubs[func.file][func.symbol] || {};
				swilibStubs[func.file][func.symbol][platform] = `#define ${func.symbol}() ((__typeof__(${func.symbol}())) SWI_${sprintf("%04X", id)})`;

				if (!isInvalid) {
					symbols[phone].push([
						`.equ ${func.symbol}_VALUE, ${sprintf("0x%08X", entry.value)}`,
					].join("\n"));
				}
			}
		}
	}

	if (!fs.existsSync(`${dir}/gen`))
		fs.mkdirSync(`${dir}/gen`);

	const swilibS: string[] = [];
	for (const phone of swilibConfig.phones) {
		swilibS.push([
			`#ifdef ${phone}`,
			`\t#include "gen/${phone}.S"`,
			`#endif`
		].join("\n"));
	}
	console.log(`-> ${dir}/swilib.S`);
	fs.writeFileSync(`${dir}/swilib.S`, `@ Code generated. DO NOT EDIT!\n` + swilibS.join("\n\n") + "\n");

	const swilibValuesH: string[] = [];
	for (const phone of swilibConfig.phones) {
		swilibValuesH.push([
			`#ifdef ${phone}`,
			`\t#include "gen/${phone}.h"`,
			`#endif`
		].join("\n"));
	}
	console.log(`-> ${dir}/swilib-values.h`);
	fs.writeFileSync(`${dir}/swilib-values.h`, `#pragma once\n// Code generated. DO NOT EDIT!\n` + swilibValuesH.join("\n\n") + "\n");

	for (const phone in symbols) {
		const fileS = `${dir}/gen/${phone}.S`;
		console.log(`-> ${fileS}`);
		fs.writeFileSync(fileS, `@ Code generated. DO NOT EDIT!\n` + symbols[phone].join("\n\n") + "\n");

		const fileH = `${dir}/gen/${phone}.h`;
		console.log(`-> ${fileH}`);
		fs.writeFileSync(fileH, `#pragma once\n// Code generated. DO NOT EDIT!\n` + values[phone].join("\n\n") + "\n");
	}

	for (const file in swilibStubs) {
		const headerPath = `${dir}/${file}`;
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
				platforms.length == swilibConfig.platforms.length &&
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
}

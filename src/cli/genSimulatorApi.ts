import fs from 'node:fs';
import { sprintf } from 'sprintf-js';
import { CLIBaseOptions } from "#src/cli.js";
import { createAppCommand } from "#src/utils/command.js";
import { loadLibraryForAll, loadLibraryForTarget } from "#src/utils/swilib.js";
import { getSwilibPlatform, getSwilibPlatforms, loadSwilibConfig, Swilib, SwiType } from "@sie-js/swilib";

import { SDK_DIR } from "#src/utils/sdk.js";

interface Options extends CLIBaseOptions {
	output: string;
}

export default createAppCommand<Options>(async ({ output }) => {
	const swilibConfig = loadSwilibConfig(SDK_DIR);

	// ELKA, NSG, X75, SG
	const targets = ['EL71v45', 'C81v51', 'CX75v25', 'S65v58'];
	const stubs: Array<string | undefined> = [];
	const table: string[] = [];
	const unimplemented: Record<string, string[]> = {};

	for (let id = 0; id <= 0xFFF; id++) {
		stubs[id] =
			`static void __swi_${sprintf("%04x", id)}() {\n` +
			`	loader_swi_stub(${sprintf("0x%04x", id)});\n` +
			`}`;
		table[id] = `__swi_${sprintf("%04x", id)}`;
	}

	const targetToSwilib: Record<string, Swilib> = {};
	for (const target of targets) {
		const { swilib } = await loadLibraryForTarget(target);
		targetToSwilib[target] = swilib;
	}

	const { maxFunctionId, platformToLib } = await loadLibraryForAll(swilibConfig);
	for (let id = 0; id <= maxFunctionId; id++) {
		const sdkEntry = getSwilibPlatforms()
			.map(p => platformToLib[p].entries[id])
			.find(Boolean);
		if (!sdkEntry)
			continue;

		if (sdkEntry.files.indexOf('swilib/patch.h') >= 0)
			continue;

		if (sdkEntry.files.indexOf('swilib/legacy.h') >= 0)
			continue;

		const underscore = [
			"dlopen", "dlsym", "dlclose", "dlerror", "longjmp", "setjmp"
		];
		const builtin = [
			"strchr", "memchr", "strpbrk", "strrchr", "strstr"
		];

		if (sdkEntry.files.indexOf('swilib/socket.h') >= 0) {
			sdkEntry.name = sdkEntry.name.replaceAll(sdkEntry.symbol + '(', 'bsd_' + sdkEntry.symbol + '(');
			sdkEntry.symbol = "bsd_" + sdkEntry.symbol;

			const replaces: Record<string, string> = {
				'in_port_t':				'bsd_in_port_t',
				'sa_family_t':				'bsd_sa_family_t',
				'in_addr_t':				'bsd_in_addr_t',
				'socklen_t':				'bsd_socklen_t',
				'sockaddr':					'bsd_sockaddr',
				'sockaddr_in':				'bsd_sockaddr_in',
				'hostent':					'bsd_hostent',
			};

			for (let k in replaces) {
				const v = replaces[k];
				sdkEntry.name = sdkEntry.name.replace(new RegExp(k, 'g'), v);
			}
		} else if (underscore.includes(sdkEntry.symbol)) {
			sdkEntry.name = sdkEntry.name.replaceAll(sdkEntry.symbol + '(', '_' + sdkEntry.symbol + '(');
			sdkEntry.symbol = "_" + sdkEntry.symbol;
		}

		let returnCode: string | undefined;
		let noStubWarn = false;
		if (sdkEntry.type == SwiType.VALUE) {
			const platformValues: Record<string, number | undefined> = {};
			for (const target of targets) {
				const platform = getSwilibPlatform(swilibConfig, target);
				platformValues[platform] = targetToSwilib[target].entries[id]?.value;
			}

			noStubWarn = true;
			returnCode =
				`#if defined(ELKA)\n` +
				`\treturn ${platformValues.ELKA ?? '0xFFFFFFFF'};\n` +
				`#elif defined(NEWSGOLD)\n` +
				`\treturn ${platformValues.NSG ?? '0xFFFFFFFF'};\n` +
				`#elif defined(X75)\n` +
				`\treturn ${platformValues.X75 ?? '0xFFFFFFFF'};\n` +
				`#else\n` +
				`\treturn ${platformValues.SG ?? '0xFFFFFFFF'};\n` +
				`#endif`;

			table[id] = `${sdkEntry.symbol}()`;
			stubs[id] = undefined;
		} else if (sdkEntry.type == SwiType.POINTER) {
			table[id] = `${sdkEntry.symbol}()`;
			stubs[id] = undefined;
		} else if (sdkEntry.type == SwiType.FUNCTION) {
			table[id] = `${sdkEntry.symbol}`;
		}

		if (!returnCode) {
			const returnType = parseReturnType(sdkEntry.name).trim();
			if (returnType == "void") {
				// nothing
			} else if (returnType.match(/^(int\d+_t|int|short|char|long|ssize_t)$/)) {
				returnCode = "\treturn -1;";
			} else if (returnType.match(/^(uint\d+_t|unsigned int|unsigned short|unsigned char|unsigned long|size_t)$/)) {
				returnCode = "\treturn 0;";
			} else if (returnType.indexOf('*') >= 0) {
				returnCode = "\treturn NULL;";
			} else {
				returnCode = "\treturn 0;";
			}
		}

		if (!builtin.includes(sdkEntry.symbol)) {
			const fileId = sdkEntry.files[0];
			unimplemented[fileId] = unimplemented[fileId] || [];

			unimplemented[fileId].push(
				`${sdkEntry.name.replace(/\s+/g, ' ').trim()} {\n` +
				(noStubWarn ? '' : `\tLOGD("%s: not implemented!\\n", __func__);\n`) +
				(returnCode ? `${returnCode}\n` : ``) +
				`}`
			);
		}
	}

	let code: string[] = [];

	// stubs.cpp
	code.push(`/* Auto-generated file. See @sie-js/swilib-tools. */`);
	code.push(`#include "swilib.h"`);
	code.push(`#include <swilib.h>`);
	code.push(`#include <swilib/openssl.h>`);
	code.push(`#include <swilib/nucleus.h>`);
	code.push(`#include <swilib/png.h>`);
	code.push(`#include <swilib/zlib.h>`);
	code.push(`#include <stdio.h>`);
	code.push(`#include <stdlib.h>`);
	code.push(`#include <string.h>`);
	code.push("");

	code.push(stubs.filter(Boolean).join("\n"));
	code.push("");

	code.push(`void *swilib_functions[SWI_FUNCTIONS_CNT] = { };`);
	code.push("");
	code.push(`void loader_init_swilib() {`);
	for (let id = 0; id < table.length; id++) {
		code.push(`\tswilib_functions[${sprintf("0x%04X", id)}] = (void *) ${table[id]};`);
	}
	code.push(`}`);

	fs.writeFileSync(`${output}/src/swilib.c`, code.join("\n"));

	code = [];
	code.push(`/* Auto-generated file. See @sie-js/swilib-tools. */`);
	code.push(`#include <swilib.h>`);
	code.push(`#include <swilib/openssl.h>`);
	code.push(`#include <swilib/nucleus.h>`);
	code.push(`#include <swilib/png.h>`);
	code.push(`#include <swilib/zlib.h>`);
	code.push(`#include <stdio.h>`);
	code.push(`#include <stdlib.h>`);
	code.push(`#include <string.h>`);
	code.push(`#include "log.h"`);
	code.push("");
	for (let fileId in unimplemented) {
		code.push(`/* ${fileId} */`);
		code.push(unimplemented[fileId].join("\n\n"));
		code.push("");
	}

	fs.writeFileSync(`${output}/src/swilib-stubs.cpp`, code.join("\n"));
});

function parseReturnType(def: string): string {
	def = def.replace(/\s+/g, ' ').trim();
	const m = def.match(/^(.*?\s?[*]?)([\w_]+)\(.*?\)$/i);
	if (!m)
		throw new Error(`Could not parse C definition: ${def}`);
	return m[1].trim();
}

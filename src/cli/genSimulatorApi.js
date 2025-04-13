import fs from 'fs';
import { getPlatformByPhone, swilibConfig, SwiType } from "@sie-js/swilib";
import { getPatchByID } from "../utils.js";
import { getPlatformSwilibFromSDKCached, parseSwilibPatchCached } from "../cache.js";
import { sprintf } from 'sprintf-js';

export async function genSimulatorApi({ dir }) {
	// ELKA, NSG, X75, SG
	let phones = ['EL71v45', 'C81v51', 'CX75v25', 'S65v58'];
	let stubs = [];
	let table = [];
	let unimplemented = {};

	for (let id = 0; id <= 0xFFF; id++) {
		stubs[id] =
			`static void __swi_${sprintf("%04x", id)}() {\n` +
			`	loader_swi_stub(${sprintf("0x%04x", id)});\n` +
			`}`;
		table[id] = `__swi_${sprintf("%04x", id)}`;
	}

	let allFunctions = [];
	for (let phone of phones) {
		let platform = getPlatformByPhone(phone);
		let sdklib = await getPlatformSwilibFromSDKCached(platform);
		for (let id = 0; id < sdklib.length; id++)
			allFunctions[id] = allFunctions[id] ?? sdklib[id];
	}

	for (let id = 0; id < allFunctions.length; id++) {
		let func = allFunctions[id];
		if (!func)
			continue;

		if (func.files.indexOf('swilib/patch.h') >= 0)
			continue;

		if (func.files.indexOf('swilib/legacy.h') >= 0)
			continue;

		let underscore = [
			"dlopen", "dlsym", "dlclose", "dlerror", "longjmp", "setjmp"
		];
		let builtin = [
			"strchr", "memchr", "strpbrk", "strrchr", "strstr"
		];

		if (func.files.indexOf('swilib/socket.h') >= 0) {
			func.name = func.name.replaceAll(func.symbol + '(', 'bsd_' + func.symbol + '(');
			func.symbol = "bsd_" + func.symbol;

			let replaces = {
				'in_port_t':				'bsd_in_port_t',
				'sa_family_t':				'bsd_sa_family_t',
				'in_addr_t':				'bsd_in_addr_t',
				'socklen_t':				'bsd_socklen_t',
				'sockaddr':					'bsd_sockaddr',
				'sockaddr_in':				'bsd_sockaddr_in',
				'hostent':					'bsd_hostent',
			};

			for (let k in replaces) {
				let v = replaces[k];
				func.name = func.name.replace(new RegExp(k, 'g'), v);
			}
		} else if (underscore.includes(func.symbol)) {
			func.name = func.name.replaceAll(func.symbol + '(', '_' + func.symbol + '(');
			func.symbol = "_" + func.symbol;
		}

		let returnCode;
		let noStubWarn = false;
		if (func.type == SwiType.VALUE) {
			let platformValues = {};
			for (let phone of phones) {
				let platform = getPlatformByPhone(phone);
				let patchId = swilibConfig.patches[phone];
				let file = getPatchByID(patchId);
				let swilib = await parseSwilibPatchCached(fs.readFileSync(file));
				platformValues[platform] = swilib.entries[id]?.value;
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

			table[id] = `${func.symbol}()`;
			stubs[id] = null;
		} else if (func.type == SwiType.POINTER) {
			table[id] = `${func.symbol}()`;
			stubs[id] = null;
		} else if (func.type == SwiType.FUNCTION) {
			table[id] = `${func.symbol}`;
		}

		if (!returnCode) {
			let returnType = parseReturnType(func.name).trim();
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

		if (!builtin.includes(func.symbol)) {
			let fileId = func.files[0];
			unimplemented[fileId] = unimplemented[fileId] || [];

			unimplemented[fileId].push(
				`${func.name.replace(/\s+/g, ' ').trim()} {\n` +
				(noStubWarn ? '' : `\tLOGD("%s: not implemented!\\n", __func__);\n`) +
				(returnCode ? `${returnCode}\n` : ``) +
				`}`
			);
		}
	}

	// stubs.cpp
	let code = [];
	code.push(`/* Auto-generated file!!! See @sie-js/swilib-tools! */`);
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

	code.push(stubs.join("\n"));
	code.push("");

	code.push(`void *swilib_functions[SWI_FUNCTIONS_CNT] = { };`);
	code.push("");
	code.push(`void loader_init_swilib() {`);
	for (let id = 0; id < table.length; id++) {
		code.push(`\tswilib_functions[${sprintf("0x%04X", id)}] = (void *) ${table[id]};`);
	}
	code.push(`}`);

	fs.writeFileSync(`${dir}/src/swilib.c`, code.join("\n"));

	code = [];
	code.push(`/* Auto-generated file!!! See @sie-js/swilib-tools! */`);
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

	fs.writeFileSync(`${dir}/src/swilib-stubs.cpp`, code.join("\n"));
}

function parseReturnType(def) {
	def = def.replace(/\s+/g, ' ').trim();
	let m = def.match(/^(.*?\s?[*]?)([\w\d_]+)\(.*?\)$/i);
	if (!m)
		throw new Error(`Can't parse C definition: ${def}`);
	return m[1].trim();
}

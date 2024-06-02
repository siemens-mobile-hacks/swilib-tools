import JSON5 from 'json5';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { globSync } from 'glob';

export const ROOT_DIR = path.resolve(`${import.meta.dirname}/../`);
export const PATCHES_DIR = path.resolve(`${ROOT_DIR}/../patches`);
export const SDK_DIR = path.resolve(`${ROOT_DIR}/../sdk`);

export function getPatchByID(id, model) {
	let [patchFile] = globSync(`${PATCHES_DIR}/patches/${model || '*'}/${id}-*.vkp`);
	return patchFile;
}

export function getConfig(name) {
	return JSON5.parse(fs.readFileSync(`${ROOT_DIR}/config/${name}.json5`));
}

export function getCacheDir() {
	return `${ROOT_DIR}/cache`;
}

export function getSdkDir() {
	if (!fs.existsSync(`${SDK_DIR}/.git`)) {
		throw new Error(`SDK repo not found: ${SDK_DIR}\n` +
		`Please, clone this repo: https://github.com/siemens-mobile-hacks/sdk (at the root level).`);
	}
	return SDK_DIR;
}

export function getPatchesDir() {
	if (!fs.existsSync(`${PATCHES_DIR}/.git`)) {
		throw new Error(`Patches repo not found: ${PATCHES_DIR}\n` +
			`Please, clone this repo: https://github.com/siemens-mobile-hacks/patches (at the root level).`);
	}
	return PATCHES_DIR;
}

export function md5sum(content) {
	return crypto.createHash('md5').update(content).digest('hex');
}

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { globSync } from 'glob';
import { SwilibConfig } from "@sie-js/swilib";

export const ROOT_DIR: string = path.resolve(`${import.meta.dirname}/../`);
export const CACHE_DIR: string = path.resolve(`${ROOT_DIR}/cache`);
export const PATCHES_DIR: string = findPatchesDir();
export const SDK_DIR: string = findSdkDir();

function findSdkDir(): string {
	let parentDir = path.resolve(`${process.cwd()}`);
	while (parentDir !== '/') {
		if (fs.existsSync(`${parentDir}/sdk`) && isSdkRepo(`${parentDir}/sdk`))
			return `${parentDir}/sdk`;
		parentDir = path.resolve(`${parentDir}/../`);
	}
	throw new Error('SDK repo is not found!');
}

function findPatchesDir(): string {
	let parentDir = path.resolve(`${process.cwd()}`);
	while (parentDir !== '/') {
		if (fs.existsSync(`${parentDir}/patches`) && isPatchesRepo(`${parentDir}/patches`))
			return `${parentDir}/patches`;
		parentDir = path.resolve(`${parentDir}/../`);
	}
	throw new Error('Patches repo is not found!');
}

export function getSwilibPatch(swilibConfig: SwilibConfig, target: string) {
	if (!swilibConfig.patches.has(target))
		return undefined;
	return getPatchByID(swilibConfig.patches.get(target)!, target);
}

export function getPatchByID(id: number, target?: string): string | undefined {
	const [patchFile] = globSync(`${PATCHES_DIR}/patches/${target || '*'}/${id}-*.vkp`);
	return patchFile;
}

export function md5sum(content: string | Buffer): string {
	return crypto.createHash('md5').update(content).digest('hex');
}

function isSdkRepo(path: string): boolean {
	return fs.existsSync(`${path}/.git`) && fs.existsSync(`${path}/swilib/config.toml`);
}

function isPatchesRepo(path: string): boolean {
	return fs.existsSync(`${path}/.git`) && fs.existsSync(`${path}/patches`);
}

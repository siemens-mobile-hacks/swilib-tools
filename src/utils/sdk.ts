import os from 'node:os';
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { globSync } from "glob";
import { SwilibConfig } from "@sie-js/swilib";
import { simpleGit } from "simple-git";

export let PATCHES_DIR: string;
export let SDK_DIR: string;

const possibleDirectories = [
	'dev/sie',
	'dev/siemens',
];

export function setDevRoot(rootPath: string) {
	PATCHES_DIR = `${rootPath}/patches`;
	SDK_DIR = `${rootPath}/sdk`;
}

export async function getDevRootRevision() {
	const revision: string[] = [];
	for (const repo of [SDK_DIR, PATCHES_DIR]) {
		const git = simpleGit(repo);
		const headHashId = await git.revparse("HEAD");
		revision.push(headHashId);
	}
	return revision.join('-');
}

export function findDefaultDevRoot() {
	// Find in current or parent directories
	let rootPath = path.resolve(`${process.cwd()}`);
	while (rootPath !== '/') {
		if (isDevRoot(rootPath))
			return rootPath;
		rootPath = path.resolve(`${rootPath}/../`);
	}

	// Find by heuristic
	for (const dir of possibleDirectories) {
		const rootPath = path.resolve(`${os.homedir()}/${dir}`);
		if (isDevRoot(rootPath))
			return rootPath;
	}
	return undefined;
}

function isDevRoot(path: string): boolean {
	if (!isSdkRepo(`${path}/sdk`))
		return false;
	if (!isPatchesRepo(`${path}/patches`))
		return false;
	return true;
}

function isSdkRepo(path: string): boolean {
	return fs.existsSync(`${path}/.git`) && fs.existsSync(`${path}/swilib/config.toml`);
}

function isPatchesRepo(path: string): boolean {
	return fs.existsSync(`${path}/.git`) && fs.existsSync(`${path}/patches/EL71v45`);
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

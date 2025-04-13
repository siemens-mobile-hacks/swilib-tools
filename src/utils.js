import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chalk from 'chalk';
import { globSync } from 'glob';

export const ROOT_DIR = path.resolve(`${import.meta.dirname}/../`);
export const CACHE_DIR = path.resolve(`${ROOT_DIR}/cache`);
export const PATCHES_DIR = path.resolve(`${ROOT_DIR}/../patches`);
export const SDK_DIR = path.resolve(`${ROOT_DIR}/../../sdk`);

export function getPatchByID(id, model) {
	let [patchFile] = globSync(`${PATCHES_DIR}/patches/${model || '*'}/${id}-*.vkp`);
	return patchFile;
}

export function md5sum(content) {
	return crypto.createHash('md5').update(content).digest('hex');
}

export function checkGitRepos() {
	let errors = 0;
	if (!isSdkRepo(SDK_DIR)) {
		console.error(`SDK repo is not found!`);
		console.log(`${chalk.bold('Please, run:')} git clone https://github.com/siemens-mobile-hacks/sdk ${SDK_DIR}`);
		console.log('');
		errors++;
	}
	if (!isPatchesRepo(PATCHES_DIR)) {
		console.error(`Patches repo is not found!`);
		console.log(`${chalk.bold('Please, run:')} git clone https://github.com/siemens-mobile-hacks/patches ${PATCHES_DIR}`);
		console.log('');
		errors++;
	}
	return errors == 0;
}

function isSdkRepo(path) {
	return fs.existsSync(`${path}/.git`) && fs.existsSync(`${path}/swilib`);
}

function isPatchesRepo(path) {
	return fs.existsSync(`${path}/.git`) && fs.existsSync(`${path}/patches`);
}

import fs from 'fs';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { getFunctionsSummary, getPhoneSwilib } from '../analyze.js';
import { swilibConfig, getPlatformByPhone, getSwiBlib, analyzeSwilib, getGhidraSymbols, getIdaSymbols } from '@sie-js/swilib';
import { getDataTypesHeaderCached, getLastCacheTime, getPlatformSwilibFromSDKCached, parseSwilibPatchCached } from '../cache.js';
import { getPatchByID } from '../utils.js';

export function serverCmd({ port }) {
	let app = express()
	app.use(cors());
	app.use(compression());

	// Get phones list
	app.get('/phones.json', (req, res) => {
		let platformToPhones = {};
		let phones = [];
		for (let phone of swilibConfig.phones) {
			let platform = getPlatformByPhone(phone);
			let phoneInfo = {
				name: phone,
				model: phone.split('v')[0],
				sw: +phone.split('v')[1],
				platform,
			};
			platformToPhones[platform] = platformToPhones[platform] || [];
			platformToPhones[platform].push(phoneInfo);
			phones.push(phoneInfo);
		}
		res.send({
			byPlatform: platformToPhones,
			all: phones,
		});
	});

	// Analyze swilib
	app.get('/:phone(\\w+v\\d+).json', async (req, res) => {
		let phone = req.params.phone;
		if (!swilibConfig.phones.includes(phone)) {
			res.sendStatus(404);
			return;
		}
		let response = await getPhoneSwilib(phone);
		res.send(response);
	});

	// Download blib
	app.get('/:phone(\\w+v\\d+).blib', async (req, res) => {
		let phone = req.params.phone;
		if (!swilibConfig.phones.includes(phone)) {
			res.sendStatus(404);
			return;
		}
		let patchId = swilibConfig.patches[phone];
		let patchFile = getPatchByID(patchId, phone);
		let swilib = await parseSwilibPatchCached(fs.readFileSync(patchFile));
		res.send(getSwiBlib(swilib));
	});

	// Download vkp
	app.get('/:phone(\\w+v\\d+).vkp', async (req, res) => {
		let phone = req.params.phone;
		if (!swilibConfig.phones.includes(phone)) {
			res.sendStatus(404);
			return;
		}

		let patchId = swilibConfig.patches[phone];
		let patchFile = getPatchByID(patchId, phone);
		let swilib = await parseSwilibPatchCached(fs.readFileSync(patchFile));
		let sdklib = await getPlatformSwilibFromSDKCached(getPlatformByPhone(phone));

		res.set('Content-Disposition', 'attachment');
		res.send(serializeSwilib(phone, sdklib, swilib));
	});

	// Download data types for disassembler
	app.get('/swilib-types-:platform(ELKA|NSG|X75|SG).h', async (req, res) => {
		let response = await getDataTypesHeaderCached(req.params.platform);
		res.set('Content-Disposition', 'attachment');
		res.send(response);
	});

	// Download symbols for disassembler
	app.get('/symbols-:phone(\\w+v\\d+).:ext(idc|txt)', async (req, res) => {
		let phone = req.params.phone;
		if (!swilibConfig.phones.includes(phone)) {
			res.sendStatus(404);
			return;
		}

		let patchId = swilibConfig.patches[phone];
		let patchFile = getPatchByID(patchId, phone);
		let swilib = await parseSwilibPatchCached(fs.readFileSync(patchFile));
		let sdklib = await getPlatformSwilibFromSDKCached(getPlatformByPhone(phone));

		if (req.params.ext == 'txt') {
			res.set('Content-Disposition', 'attachment');
			res.send(getGhidraSymbols(phone, sdklib, swilib) + "\n");
		} else {
			res.set('Content-Disposition', 'attachment');
			res.send(getIdaSymbols(phone, sdklib, swilib) + "\n");
		}
	});

	// List CPU symbols for disassembler
	app.get('/cpu-files.json', async (req, res) => {
		let url = "https://siemens-mobile-hacks.github.io/pmb887x-dev/index.json";
		try {
			let response = await fetch(url).then((res) => res.json());
			res.send(response);
		} catch (e) {
			res.status(502);
			res.send(`Failed to fetch ${url}`);
		}
	});

	// Download CPU symbols for disassembler
	app.get('/cpu-:cpu([a-zA-Z0-9_]+).:ext(idc|txt)', async (req, res) => {
		let url = `https://siemens-mobile-hacks.github.io/pmb887x-dev/cpu-${req.params.cpu}.${req.params.ext}`;
		try {
			let response = await fetch(url).then((res) => res.text());
			res.set('Content-Disposition', 'attachment');
			res.send(response);
		} catch (e) {
			res.status(502);
			res.send(`Failed to fetch ${url}`);
		}
	});

	// Get all functions (summary)
	app.get('/summary.json', async (req, res) => {
		let response = await getFunctionsSummary();
		res.send(response);
	});

	app.listen(port, () => {
		console.info(`Listening on port http://127.0.0.1:${port}`)
	});
}

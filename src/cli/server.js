import fs from 'fs';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { getFunctionsSummary, getPhoneSwilib } from '../analyze.js';
import { swilibConfig, getPlatformByPhone, getSwiBlib, analyzeSwilib } from '@sie-js/swilib';
import { getLastCacheTime, getPlatformSwilibFromSDKCached, parseSwilibPatchCached } from '../cache.js';
import { sprintf } from 'sprintf-js';
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

	// Get all functions (summary)
	app.get('/summary.json', async (req, res) => {
		let response = await getFunctionsSummary();
		res.send(response);
	});

	app.listen(port, () => {
		console.info(`Listening on port http://127.0.0.1:${port}`)
	});
}

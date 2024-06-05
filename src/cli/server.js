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
		let analysis = analyzeSwilib(phone, sdklib, swilib);

		let vkp = [
			`; ${phone}`,
			`${sprintf("+%08X", swilib.offset)}`,
			`#pragma enable old_equal_ff`,
		];
		for (let id = 0; id < sdklib.length; id++) {
			let func = swilib.entries[id];
			if ((id % 16) == 0)
				vkp.push('');

			let name = (sdklib[id]?.name || '').replace(/\s+/gs, ' ').trim();

			if (analysis.errors[id]) {
				vkp.push('');
				vkp.push(`; [ERROR] ${analysis.errors[id]}`);
				if (func?.value != null) {
					vkp.push(sprintf(";%03X: 0x%08X   ; %03X: %s", id * 4, func.value, id, name));
				} else {
					vkp.push(sprintf(";%03X:              ; %03X: %s", id * 4, id, name));
				}
				vkp.push('');
			} else if (sdklib[id]) {
				if (func?.value != null) {
					vkp.push(sprintf("%04X: 0x%08X   ; %03X: %s", id * 4, func.value, id, name));
				} else {
					vkp.push(sprintf(";%03X:              ; %03X: %s", id * 4, id, name));
				}
			} else {
				vkp.push(sprintf(";%03X:              ; %03X:", id * 4, id));
			}
		}
		vkp.push('');
		vkp.push(`#pragma enable old_equal_ff`);
		vkp.push(`+0`);

		res.set('Content-Disposition', 'attachment');
		res.send(vkp.join("\n"));
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

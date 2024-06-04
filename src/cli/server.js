import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { getFunctionsSummary, getPhoneSwilib } from '../analyze.js';
import { swilibConfig, getPlatformByPhone } from '@sie-js/swilib';
import { getLastCacheTime } from '../cache.js';

export function serverCmd({ port }) {
	let app = express()
	app.use(cors());
	app.use(compression());

	// Get phones list
	app.get('/phones.json', (req, res) => {
		let platformToPhones = {};
		for (let phone of swilibConfig.phones) {
			let platform = getPlatformByPhone(phone);
			platformToPhones[platform] = platformToPhones[platform] || [];
			platformToPhones[platform].push({
				name: phone,
				model: phone.split('v')[0],
				sw: +phone.split('v')[1],
			});
		}
		res.send(platformToPhones);
	});

	// Analyze swilib
	app.get('/:phone(\\w+v\\d+).json', async (req, res) => {
		let phone = req.params.phone;
		if (!swilibConfig.phones.includes(phone)) {
			res.sendStatus(404);
			return;
		}
		let response = await getPhoneSwilib(phone);
		res.set('Last-Cache-Update', getLastCacheTime());
		res.send(response);
	});

	// Get all functions (summary)
	app.get('/summary.json', async (req, res) => {
		let response = await getFunctionsSummary();
		res.set('Last-Cache-Update', getLastCacheTime());
		res.send(response);
	});

	app.listen(port, () => {
		console.info(`Listening on port http://127.0.0.1:${port}`)
	});
}

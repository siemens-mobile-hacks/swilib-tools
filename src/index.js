import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { getFunctionsSummary, getFunctionsForPhone } from './analyze.js';
import SWI_CONFIG from './config.js';
import { getPlatformByPhone } from '@sie-js/swilib';

const HTTP_PORT = 4000;

let app = express()
app.use(cors());
app.use(compression());

// Get phones list
app.get('/phones.json', (req, res) => {
	let platformToPhones = {};
	for (let phone of SWI_CONFIG.phones) {
		let platform = getPlatformByPhone(phone);
		platformToPhones[platform] = platformToPhones[platform] || [];
		platformToPhones[platform].push(phone);
	}
	res.send(platformToPhones);
});

// Get all functions (summary)
app.get('/functions.json', (req, res) => {
	let summary = getFunctionsSummary();
	res.send({
		files: summary.functionsByFile,
		functionsByPhone: summary.functionsByPhone,
		timestamp: Date.now(),
			 nextId: summary.maxFunctionId,
	});
});

app.get('/functions-summary-by-file.json', (req, res) => {
	let summary = getFunctionsSummary();
	res.send({
		files: summary.functionsByFile,
		functionsByPhone: summary.functionsByPhone,
		timestamp: Date.now(),
		nextId: summary.maxFunctionId,
	});
});
app.get('/functions-summary.json', (req, res) => {
	let summary = getFunctionsSummary();
	res.send({
		files: {
			'swilib.h': summary.functions
		},
		functionsByPhone: summary.functionsByPhone,
		timestamp: Date.now(),
		nextId: summary.maxFunctionId,
	});
});
app.get('/functions-phone-:phone(\\w+v\\d+).json', (req, res) => {
	res.send(getFunctionsForPhone(req.params.phone));
});

app.listen(HTTP_PORT, () => {
	console.log(`Listening on port http://localhost:${HTTP_PORT}`)
});

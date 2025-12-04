import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { getFunctionsSummary, getPhoneSwilib } from './analyze.js';
import { swilibConfig, getPlatformByPhone } from '@sie-js/swilib';
import { Request, Response } from 'express';

const HTTP_PORT = 4000;

const app = express();
app.use(cors());
app.use(compression());

// Get phones list
app.get('/phones.json', (req: Request, res: Response) => {
	const platformToPhones: Record<string, string[]> = {};
	for (let phone of swilibConfig.phones) {
		const platform = getPlatformByPhone(phone);
		platformToPhones[platform] = platformToPhones[platform] || [];
		platformToPhones[platform].push(phone);
	}
	res.send(platformToPhones);
});

// Get all functions (summary)
app.get('/functions.json', async (req: Request, res: Response) => {
	const summary = await getFunctionsSummary();
	res.send({
		files: summary.functions,
		functionsByPhone: summary.functionsByPhone,
		timestamp: Date.now(),
		nextId: summary.nextId,
	});
});

app.get('/functions-summary-by-file.json', async (req: Request, res: Response) => {
	const summary = await getFunctionsSummary();
	res.send({
		files: summary.functions,
		functionsByPhone: summary.functionsByPhone,
		timestamp: Date.now(),
		nextId: summary.nextId,
	});
});

app.get('/functions-summary.json', async (req: Request, res: Response) => {
	const summary = await getFunctionsSummary();
	res.send({
		files: {
			'swilib.h': summary.functions
		},
		functionsByPhone: summary.functionsByPhone,
		timestamp: Date.now(),
		nextId: summary.nextId,
	});
});

app.get('/functions-phone-:phone(\\w+v\\d+).json', async (req: Request, res: Response) => {
	try {
		const result = await getPhoneSwilib(req.params.phone);
		res.send(result);
	} catch (error) {
		res.status(500).send({ error: (error as Error).message });
	}
});

app.listen(HTTP_PORT, () => {
	console.log(`Listening on port http://localhost:${HTTP_PORT}`);
});

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { getFunctionsSummary, getPhoneSwilib } from '../analyze.js';
import { swilibConfig, getPlatformByPhone, getSwiBlib } from '@sie-js/swilib';


export function serverCmd({ port }) {
    const app = express();
    app.use(cors());
    app.use(compression());

    // Get phones list
    app.get('/phones.json', (req, res) => {
        let platformToPhones = {};
        let phones = [];
        for (let phone of swilibConfig.phones) {
            const platform = getPlatformByPhone(phone);
            const phoneInfo = {
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
        const phone = req.params.phone;
        if (!swilibConfig.phones.includes(phone)) {
            res.sendStatus(404);
            return;
        }
        const response = await getPhoneSwilib(phone);
        res.send(response);
    });

    // Download blib
    app.get('/:phone(\\w+v\\d+).blib', async (req, res) => {
        const phone = req.params.phone;
        if (!swilibConfig.phones.includes(phone)) {
            res.sendStatus(404);
            return;
        }
        res.send(getSwiBlib(swilib));
    });

	// Download vkp
	app.get('/:phone(\\w+v\\d+).blib', async (req, res) => {
		const phone = req.params.phone;
		if (!swilibConfig.phones.includes(phone)) {
			res.sendStatus(404);
			return;
		}
		res.send(getSwiBlib(swilib));
	});

    // Get all functions (summary)
    app.get('/summary.json', async (req, res) => {
        const response = await getFunctionsSummary();
        res.send(response);
    });

    app.listen(port, () => {
        console.info(`Listening on port http://127.0.0.1:${port}`);
    });
}

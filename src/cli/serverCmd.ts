import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { Request, Response } from 'express';
import { getFunctionsSummary, getPhoneSwilib } from '../analyze';
import { swilibConfig, getPlatformByPhone, getSwiBlib } from '@sie-js/swilib';
import { getPatchByID } from '../utils';
import { parseSwilibPatchCached } from '../cache';
import fs from 'fs';

interface ServerCmdOptions {
    port: number;
}

interface PhoneInfo {
    name: string;
    model: string;
    sw: number;
}

export function serverCmd({ port }: ServerCmdOptions): void {
    const app = express();
    app.use(cors());
    app.use(compression());

    // Get phones list
    app.get('/phones.json', (req: Request, res: Response) => {
        let platformToPhones: Record<string, PhoneInfo[]> = {};
        let phones: PhoneInfo[] = [];
        for (let phone of swilibConfig.phones) {
            const platform = getPlatformByPhone(phone);
            const phoneInfo: PhoneInfo = {
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
    app.get('/:phone(\\w+v\\d+).json', async (req: Request, res: Response) => {
        const phone = req.params.phone;
        if (!swilibConfig.phones.includes(phone)) {
            res.sendStatus(404);
            return;
        }
        const response = await getPhoneSwilib(phone);
        res.send(response);
    });

    // Download blib
    app.get('/:phone(\\w+v\\d+).blib', async (req: Request, res: Response) => {
        const phone = req.params.phone;
        if (!swilibConfig.phones.includes(phone)) {
            res.sendStatus(404);
            return;
        }

        const patchId = swilibConfig.patches[phone];
        const patchFile = getPatchByID(patchId, phone);
        if (!patchFile) {
            res.sendStatus(404);
            return;
        }

        const swilib = await parseSwilibPatchCached(fs.readFileSync(patchFile));
        res.send(getSwiBlib(swilib));
    });

    // Get all functions (summary)
    app.get('/summary.json', async (req: Request, res: Response) => {
        const response = await getFunctionsSummary();
        res.send(response);
    });

    app.listen(port, () => {
        console.info(`Listening on port http://127.0.0.1:${port}`);
    });
}

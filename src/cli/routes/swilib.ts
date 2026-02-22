import { FastifyInstance } from "fastify";
import {
	getGhidraSymbols,
	getIdaSymbols,
	getSwiBlib,
	isValidSwilibPlatform,
	loadSwilibConfig,
	parseSwilibPatch,
	serializeSwilib,
	Swilib
} from "@sie-js/swilib";
import { getSwilibDevices, getSwilibSummaryAnalysis, getTargetSwilibAnalysis } from "#src/analyze.js";
import { loadLibraryForTarget } from "#src/utils/swilib.js";
import { cached } from "#src/utils/cache.js";
import { SDK_DIR } from "#src/utils/sdk.js";
import { getSwilibDiff } from "#src/merge.js";

interface DownloadRoute {
	Params: {
		target: string;
		type: string;
	}
}

interface AnalyzeSwilibRoute {
	Params: {
		target: string;
	}
}

interface AnalyzeUploadedSwilibRoute {
	Body: {
		platform?: string;
		code?: string;
	}
}

interface DiffSwilibRoute {
	Body: {
		platform?: string;
		left?: string;
		right?: string;
	}
}

export function swilibRoutes(fastify: FastifyInstance) {
	// Get devices list
	fastify.get('/devices', async () => {
		return getSwilibDevices();
	});

	// Analyze all targets
	fastify.get('/analyze/all', async () => {
		return cached(`swilib-analysis-all`, () => getSwilibSummaryAnalysis());
	});

	// Analyze swilib
	fastify.get<AnalyzeSwilibRoute>('/analyze/:target', async (request) => {
		const target = request.params.target;
		return cached(`swilib-analysis-${target}`, () => getTargetSwilibAnalysis(target));
	});

	// Analyze uploaded swilib
	fastify.post<AnalyzeUploadedSwilibRoute>('/analyze', async (request) => {
		const platform = request.body.platform;
		if (!platform || !isValidSwilibPlatform(platform))
			throw new Error(`Invalid platform: ${platform}`);
		return getTargetSwilibAnalysis(platform, { code: request.body.code });
	});

	// Diff two uploaded swilib's
	fastify.post<DiffSwilibRoute>('/diff', async (request) => {
		const swilibConfig = loadSwilibConfig(SDK_DIR);
		const platform = request.body.platform;
		if (!platform || !isValidSwilibPlatform(platform))
			throw new Error(`Invalid platform: ${platform}`);
		const swilibs: Swilib[] = [];
		for (const code of [request.body.left, request.body.right]) {
			if (!code)
				throw new Error('Missing swilib code');
			swilibs.push(parseSwilibPatch(swilibConfig, code, { platform }));
		}
		return getSwilibDiff(platform, swilibs);
	});

	// Download as .blib, .vkp, .txt or .idc
	fastify.get<DownloadRoute>('/download/:target/:filename.:type', async (request, reply) => {
		const target = request.params.target;
		const type = request.params.type;
		const { swilibConfig, sdklib, swilib } = await loadLibraryForTarget(target);

		switch (type) {
			case 'blib':
				reply.header('Content-Disposition', 'attachment')
					.send(getSwiBlib(swilib));
				break;

			case 'vkp':
				reply.header('Content-Disposition', 'attachment')
					.send(serializeSwilib(swilibConfig, swilib, sdklib));
				break;

			case 'idc':
				reply.header('Content-Disposition', 'attachment')
					.send(getIdaSymbols(swilibConfig, swilib, sdklib));
				break;

			case 'txt':
				reply.header('Content-Disposition', 'attachment')
					.send(getGhidraSymbols(swilibConfig, swilib, sdklib));
				break;

			default:
				reply.code(404);
				break;
		}
	});
}

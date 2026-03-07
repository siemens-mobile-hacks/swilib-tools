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
		format: string;
	}
	Body: {
		code?: string;
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
	const getDownloadPayload = async (format: string, target: string, code?: string) => {
		const { swilibConfig, sdklib, swilib } = await loadLibraryForTarget(target, { code });
		switch (format) {
			case 'blib':
				return getSwiBlib(swilib);

			case 'vkp':
				return serializeSwilib(swilibConfig, swilib, sdklib);

			case 'idc':
				return getIdaSymbols(swilibConfig, swilib, sdklib);

			case 'txt':
				return getGhidraSymbols(swilibConfig, swilib, sdklib);
		}
		return undefined;
	}

	fastify.get<DownloadRoute>('/download/:target/:filename.:format', async (request, reply) => {
		const payload = await getDownloadPayload(request.params.format, request.params.target);
		if (!payload) {
			reply.code(404);
			return;
		}
		reply.header('Content-Disposition', 'attachment').send(payload);
	});

	fastify.post<DownloadRoute>('/download/:target/:filename.:format', async (request, reply) => {
		const payload = await getDownloadPayload(request.params.format, request.params.target, request.body.code);
		if (!payload) {
			reply.code(404);
			return;
		}
		reply.header('Content-Disposition', 'attachment').send(payload);
	});
}

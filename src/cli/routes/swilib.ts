import { FastifyInstance } from "fastify";
import { getGhidraSymbols, getIdaSymbols, getSwiBlib, serializeSwilib } from "@sie-js/swilib";
import { getSwilibDevices, getSwilibSummaryAnalysis, getTargetSwilibAnalysis } from "#src/analyze.js";
import { loadLibraryForTarget } from "#src/utils/swilib.js";
import { cached } from "#src/utils/cache.js";

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

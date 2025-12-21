import { FastifyInstance } from "fastify";
import { SDK_DIR } from "#src/utils.js";
import {
	analyzeSwilib,
	getGhidraSymbols,
	getIdaSymbols,
	getSwiBlib,
	loadSwilibConfig,
	serializeSwilib
} from "@sie-js/swilib";
import { getSwilibSummaryAnalysis } from "#src/analyze.js";
import { loadLibraryForTarget } from "#src/utils/swilib.js";

export function swilibRoutes(fastify: FastifyInstance) {
	// Get phone list
	fastify.get('/phones', async () => {
		const swilibConfig = loadSwilibConfig(SDK_DIR);
		return swilibConfig.targets.map((target) => {
			const model = target.split('v')[0];
			const sw = +target.split('v')[1];
			return {
				target: target,
				model,
				sw,
				platform: swilibConfig.platforms.get(model),
				patchId: swilibConfig.patches.get(target),
			};
		});
	});

	// Analyze all targets
	fastify.get('/analyze/all', async (request, reply) => {
		return getSwilibSummaryAnalysis();
	});

	// Analyze swilib
	fastify.get<{ Params: { target: string } }>('/analyze/:target', async (request, reply) => {
		const target = request.params.target;
		const { swilibConfig, sdklib, swilib } = await loadLibraryForTarget(target);
		const analysis = analyzeSwilib(swilibConfig, swilib, sdklib);
		return { swilib, analysis };
	});

	// Download as .blib, .vkp, .txt or .idc
	fastify.get<{ Params: { target: string; type: string } }>('/download/:target/:filename.:type', async (request, reply) => {
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

import { FastifyInstance } from "fastify";
import { SDK_DIR } from "#src/utils.js";
import { getDataTypesHeader, isValidSwilibPlatform } from "@sie-js/swilib";

const PMB887X_DEV = `https://siemens-mobile-hacks.github.io/pmb887x-dev`;

export async function disassemblerRoutes(fastify: FastifyInstance) {
	// List CPU symbols for disassembler
	fastify.get('/cpu-symbols', async (request, reply) => {
		const url = `${PMB887X_DEV}/index.json`;
		const response = await fetch(url);
		if (response.ok) {
			reply.send(await response.json());
		} else {
			reply.status(response.status);
		}
	});

	// Download data types for disassembler
	fastify.get<{ Params: { platform: string } }>('/download/types/:platform/:filename.h', async (request, reply) => {
		const platform = request.params.platform;
		if (!isValidSwilibPlatform(platform))
			return reply.code(404);
		const header = getDataTypesHeader(SDK_DIR, platform);
		return reply.header('Content-Disposition', 'attachment').send(header);
	});

	// Download CPU symbols for disassembler
	fastify.get<{ Params: { cpu: string; ext: string } }>('/download/cpu/:cpu/:filename.:ext', async (request, reply) => {
		const url = `${PMB887X_DEV}/cpu-${request.params.cpu}.${request.params.ext}`;
		const response = await fetch(url);
		if (response.ok) {
			reply.header('Content-Disposition', 'attachment');
			reply.send(await response.text());
		} else {
			reply.status(response.status);
		}
	});
}

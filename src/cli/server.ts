import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from "@fastify/multipart";
import { CLIBaseOptions } from "#src/cli.js";
import { createAppCommand } from "#src/utils/command.js";
import { swilibRoutes } from "#src/cli/routes/swilib.js";
import { disassemblerRoutes } from "#src/cli/routes/disassembler.js";

export interface Options extends CLIBaseOptions {
	listen: string;
	port: string;
}

export default createAppCommand<Options>(async (options) => {
	const fastify = Fastify({
		logger: false
	});
	await fastify.register(fastifyCors);
	await fastify.register(fastifyMultipart);
	fastify.register(swilibRoutes, { prefix: '/api/swilib' });
	fastify.register(disassemblerRoutes, { prefix: '/api/disassembler' });
	fastify.listen({ port: parseInt(options.port) }, function (err, address) {
		if (err) {
			fastify.log.error(err);
			process.exit(1);
		}
		console.log(`Server listening on ${address}`);
	});
});

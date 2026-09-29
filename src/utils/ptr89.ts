import { execFile } from "node:child_process";

const MAX_OUTPUT_SIZE = 64 * 1024 * 1024;

export interface Ptr89SearchResult {
	address: number;
	offset?: number;
	bytes?: string;
}

export interface Ptr89Search {
	pattern: string;
	type: string;
	results: Ptr89SearchResult[];
}

interface Ptr89JsonOutput {
	patterns?: Ptr89Search[];
	error?: string;
}

export class Ptr89PatternError extends Error { }

export class Ptr89Cli {
	constructor(private readonly executable = process.env.PTR89_BIN ?? 'ptr89') { }

	async getVersion(): Promise<string> {
		return (await run(this.executable, ['--version'])).trim();
	}

	async find(file: string, pattern: string, limit = 100): Promise<Ptr89Search> {
		let stdout: string;
		try {
			stdout = await run(this.executable, [
				'-f', file,
				'-A', 'arm',
				'-J',
				'-n', String(limit),
				'-p', pattern,
			]);
		} catch (error) {
			stdout = error instanceof ExecFileError ? error.stdout : '';
			const output = parseOutput(stdout);
			if (output?.error)
				throw new Ptr89PatternError(firstLine(output.error));
			throw error;
		}

		const output = parseOutput(stdout);
		const search = output?.patterns?.[0];
		if (!search)
			throw new Error(`Invalid JSON output from ${this.executable}.`);
		return search;
	}
}

class ExecFileError extends Error {
	constructor(message: string, readonly stdout: string) {
		super(message);
	}
}

function run(executable: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(executable, args, { encoding: 'utf8', maxBuffer: MAX_OUTPUT_SIZE }, (error, stdout, stderr) => {
			if (error) {
				const details = stderr.trim() || error.message;
				reject(new ExecFileError(`${executable}: ${details}`, stdout));
			} else {
				resolve(stdout);
			}
		});
	});
}

function parseOutput(stdout: string): Ptr89JsonOutput | undefined {
	try {
		return JSON.parse(stdout) as Ptr89JsonOutput;
	} catch {
		return undefined;
	}
}

function firstLine(message: string): string {
	return message.split('\n', 1)[0];
}

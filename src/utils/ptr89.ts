import promiseSpawn from "@npmcli/promise-spawn";

type Ptr89SearchType = 'address' | 'pointer' | 'reference' | 'branch';
type Ptr89XRefType = 'pointer' | 'reference' | 'branch';

interface Ptr89SearchResult {
	address: number;
	offset?: number;
	bytes?: string;
}

interface Ptr89Search {
	pattern: string;
	type: Ptr89SearchType;
	results: Ptr89SearchResult[];
}

interface Ptr89XRef {
	xref: number;
	offset: number;
	type: Ptr89XRefType;
}

interface Ptr89Function {
	id: number;
	name: string;
	pattern: string;
	type: Ptr89SearchType;
	result: Ptr89SearchResult | null;
}

type Ptr89JsonOutput =
	{ error: string } |
	{ patterns: Ptr89Search[] } |
	{ target: number; xrefs: Ptr89XRef[] } |
	{ functions: Ptr89Function[] } |
	{ pattern: string };

export async function findPattern(file: string, pattern: string): Promise<{ type: Ptr89SearchType; address?: number }> {
	const output = JSON.parse(await run(['-f', file, '-A', 'arm', '-J', '-n', '1', '-p', pattern])) as Ptr89JsonOutput;
	const result = 'patterns' in output ? output.patterns[0] : undefined;
	if (!result)
		throw new Error(`Invalid JSON output from ptr89.`);
	return { type: result.type, address: result.results[0]?.address };
}

async function run(args: string[]): Promise<string> {
	return promiseSpawn('ptr89', args)
		.then(result => result.stdout)
		.catch(error => {
			let output: Ptr89JsonOutput | undefined;
			try {
				output = JSON.parse(error.stdout) as Ptr89JsonOutput;
			} catch { }
			if (output && 'error' in output)
				throw new Error(output.error.split('\n', 1)[0]);
			throw new Error(`ptr89: ${error.stderr || error.message}`);
		});
}

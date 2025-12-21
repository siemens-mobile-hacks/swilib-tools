import chalk from "chalk";

export function formatFuncName(signature?: string): string {
	if (!signature)
		return chalk.gray('// unused');
	const m = signature.trim().match(/^(.*?)\s+([*]+)?([\w\d]+)\s*\((.+?)?\)$/is);
	if (m) {
		const args = m[4] != "" && m[4] != "void" ? "…" : "void";
		return `${m[1]} ${m[2] || ''}${chalk.bold(m[3])}${chalk.gray('(' + args + ')')}`;
	}
	return signature;
}

export function formatId(id: number): string {
	return id.toString(16).padStart(3, '0').toUpperCase();
}

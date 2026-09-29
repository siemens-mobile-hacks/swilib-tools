import { Sdklib, Swilib, SwilibAnalysisResult, SwilibPattern, SwiType } from "@sie-js/swilib";
import { SwilibPatternCache } from "#src/patternCache.js";

export interface SwilibPatternAudit {
	errors: Record<number, string>;
	checked: number;
	matched: number;
}

export function auditSwilibPatterns(
	swilib: Swilib,
	sdklib: Sdklib,
	patterns: Array<SwilibPattern | undefined>,
	cache: SwilibPatternCache,
): SwilibPatternAudit {
	const errors: Record<number, string> = {};
	let checked = 0;
	let matched = 0;

	for (let id = 0; id < patterns.length; id++) {
		const pattern = patterns[id]?.pattern;
		const swiEntry = swilib.entries[id];
		if (!pattern || !swiEntry)
			continue;

		const cacheEntry = cache[id];
		if (!cacheEntry)
			throw new Error(`Invalid pattern cache at #${formatId(id)}.`);

		checked++;
		if (cacheEntry.error) {
			errors[id] = `Invalid pattern: ${cacheEntry.error}`;
			continue;
		}

		const isFunction = sdklib.entries[id]?.type === SwiType.FUNCTION;
		if (cacheEntry.address !== undefined && addressesMatch(swiEntry.value, cacheEntry.address, isFunction)) {
			matched++;
		} else {
			errors[id] = formatMismatchError(cacheEntry.address);
		}
	}

	return { errors, checked, matched };
}

export function applySwilibPatternAudit(analysis: SwilibAnalysisResult, audit: SwilibPatternAudit): void {
	for (const [idText, error] of Object.entries(audit.errors)) {
		const id = Number(idText);
		if (analysis.errors[id])
			continue;
		analysis.errors[id] = error;
		analysis.stat.good--;
		analysis.stat.bad++;
	}
}

function addressesMatch(expected: number, actual: number, isFunction: boolean): boolean {
	if (expected === actual)
		return true;
	return isFunction && (expected & 0xFFFFFFFE) === (actual & 0xFFFFFFFE);
}

function formatMismatchError(address?: number): string {
	if (address === undefined)
		return `Pattern not found.`;
	return `Pattern found at ${formatAddress(address)}.`;
}

function formatAddress(address: number): string {
	return `0x${address.toString(16).padStart(8, '0').toUpperCase()}`;
}

function formatId(id: number): string {
	return id.toString(16).padStart(3, '0').toUpperCase();
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_ATTACHMENT_SIZE } from './attachment-limits';

/** Bytes from a BODY_SIZE_LIMIT value, read the way adapter-node does ("11M"). */
function parseBytes(value: string): number {
	const multiplier = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[value.at(-1)!.toUpperCase()] ?? 1;
	return Number(multiplier === 1 ? value : value.slice(0, -1)) * multiplier;
}

describe('BODY_SIZE_LIMIT', () => {
	it('lets the Docker image accept uploads up to MAX_ATTACHMENT_SIZE', () => {
		const dockerfile = readFileSync(new URL('../../../Dockerfile', import.meta.url), 'utf8');
		const value = dockerfile.match(/^ENV BODY_SIZE_LIMIT=(\S+)$/m)?.[1];
		expect(value, 'Dockerfile sets no BODY_SIZE_LIMIT').toBeDefined();
		// Room for the multipart form around the file.
		expect(parseBytes(value!)).toBeGreaterThanOrEqual(MAX_ATTACHMENT_SIZE + 64 * 1024);
	});
});

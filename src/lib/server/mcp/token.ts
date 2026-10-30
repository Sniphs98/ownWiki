import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Whether `given` is the configured MCP token. Without a configured token
 * nothing matches — the MCP endpoint is off. Compares hashes in constant
 * time, so neither the token's content nor its length leaks through timing.
 */
export function isMcpToken(given: string | null | undefined, configured: string | undefined) {
	if (!configured || !given) return false;
	return timingSafeEqual(digest(given), digest(configured));
}

/**
 * The token a request brings: as `Authorization: Bearer …`, or as the last
 * part of the address (/mcp/<token>) for clients that can't send their own
 * headers, like ChatGPT's connectors.
 */
export function requestMcpToken(request: Request, pathToken: string | undefined) {
	const header = request.headers.get('authorization');
	const bearer = header?.match(/^Bearer\s+(.+)$/i)?.[1];
	return bearer ?? pathToken ?? null;
}

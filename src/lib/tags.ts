export const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;

/**
 * A tag as stored and shown: lowercase, words joined by "-", only letters,
 * digits, "-" and "_" ("#Neue Mitarbeiter" → "neue-mitarbeiter"). Empty if
 * nothing usable is left.
 */
export function normalizeTag(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-')
		.replace(/[^\p{L}\p{N}_-]/gu, '')
		.replace(/-{2,}/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_TAG_LENGTH);
}

/** The tags in what someone typed — separated by commas — each once, at most MAX_TAGS. */
export function parseTags(input: string | string[]): string[] {
	const parts = Array.isArray(input) ? input : input.split(',');
	const tags = parts.map(normalizeTag).filter(Boolean);
	return [...new Set(tags)].slice(0, MAX_TAGS);
}

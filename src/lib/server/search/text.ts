import { isDiagramKind } from '$lib/diagrams/kinds';
import { MATCH_END, MATCH_START, type SnippetPart } from './types';

/**
 * Turns a page's markdown into the plain text that gets indexed and shown
 * in result snippets: no markup, link targets or diagram sources (BPMN
 * XML, Excalidraw JSON and Mermaid syntax would only produce noise).
 */
export function markdownToSearchText(markdown: string): string {
	const lines: string[] = [];
	let fence: { marker: string; skip: boolean } | null = null;

	for (const line of markdown.split('\n')) {
		const fenceMatch = line.match(/^\s*(`{3,}|~{3,})\s*([\w-]*)/);
		if (fence) {
			if (fenceMatch && fenceMatch[1].startsWith(fence.marker)) fence = null;
			else if (!fence.skip) lines.push(line);
			continue;
		}
		if (fenceMatch) {
			fence = { marker: fenceMatch[1], skip: isDiagramKind(fenceMatch[2] ?? '') };
			continue;
		}
		lines.push(line);
	}

	return (
		lines
			.join('\n')
			// The sentinel characters snippets use for highlighting.
			.replaceAll(MATCH_START, '')
			.replaceAll(MATCH_END, '')
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt text
			// Wiki links, also in the escaped form Milkdown stores: \[\[Name|Label]]
			.replace(
				/\\?\[\\?\[([^\]|]+?)(?:\|([^\]]+?))?\\?\]\\?\]/g,
				(_, target, label) => label ?? target
			)
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → their text
			.replace(/<[^>]+>/g, ' ') // inline HTML
			.replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
			.replace(/^\s*>\s?/gm, '') // quotes
			.replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, '') // list items
			.replace(/^\s*\|?\s*:?-{3,}.*$/gm, '') // table separator rows
			.replace(/\|/g, ' ') // table cells
			.replace(/(\*\*|__|~~|[*_`])/g, '') // emphasis, inline code
			.replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, '$1') // markdown escapes
			.replace(/\s+/g, ' ')
			.trim()
	);
}

/** Splits a database snippet with MATCH_START/MATCH_END marks into parts. */
export function toSnippet(raw: string): SnippetPart[] {
	const parts: SnippetPart[] = [];
	for (const piece of raw.split(MATCH_START)) {
		const end = piece.indexOf(MATCH_END);
		if (end === -1) {
			if (piece) parts.push({ text: piece, match: false });
			continue;
		}
		parts.push({ text: piece.slice(0, end), match: true });
		if (end + 1 < piece.length) parts.push({ text: piece.slice(end + 1), match: false });
	}
	return parts;
}

/**
 * The words of a search query: letters and digits only, lowercased, so
 * nothing a user types can break out of the query syntax.
 */
export function queryTerms(query: string): string[] {
	return (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 10);
}

/**
 * SQLite's full-text search has no German stemmer. Cutting common German
 * endings off query words and matching them as prefixes gets close:
 * "Kündigungen" → kündigung* (finds "Kündigung", "Kündigungsfrist").
 * PostgreSQL does real stemming instead (search.pg.ts).
 */
export function germanPrefix(term: string): string {
	for (const suffix of ['ungen', 'en', 'er', 'es', 'e', 'n', 's']) {
		if (term.endsWith(suffix) && term.length - suffix.length >= 4) {
			return suffix === 'ungen'
				? term.slice(0, -suffix.length) + 'ung'
				: term.slice(0, -suffix.length);
		}
	}
	return term;
}

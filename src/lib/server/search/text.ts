import { isDiagramKind } from '$lib/diagrams/kinds';
import { closesFence, fenceOpening } from '$lib/markdown-code';
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
		if (fence) {
			if (closesFence(line, fence.marker)) fence = null;
			else if (!fence.skip) lines.push(line);
			continue;
		}
		const opening = fenceOpening(line);
		if (opening) {
			fence = { marker: opening.marker, skip: isDiagramKind(opening.info.split(/\s/)[0]) };
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
			// Wiki links, also in the escaped form Milkdown stores: \[\[Name|Label]]
			// (\[\[Name\|Label]] in a table).
			.replace(
				/\\?\[\\?\[([^\]|]+?)(?:\\?\|([^\]]+?))?\\?\]\\?\]/g,
				(_, target, label) => label ?? target
			)
			// Escaped characters are text: set aside, so the markup rules
			// below don't strip them (or leave their backslash behind).
			.replace(MARKDOWN_ESCAPE, (_, char: string) => escaped(char))
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images → alt text
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → their text
			.replace(/<[^>]+>/g, ' ') // inline HTML
			.replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
			.replace(/^\s*>\s?/gm, '') // quotes
			.replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/gm, '') // list items
			.replace(/^\s*\|?\s*:?-{3,}.*$/gm, '') // table separator rows
			.replace(/\|/g, ' ') // table cells
			.replace(/(\*\*|__|~~|[*_`])/g, '') // emphasis, inline code
			.replace(ESCAPED, (char) => unescaped(char))
			.replace(/\s+/g, ' ')
			.trim()
	);
}

const MARKDOWN_ESCAPE = /\\([\\`*_{}[\]()#+\-.!|>~])/g;
// Private-use characters stand in for escaped ones while the markup is removed.
const ESCAPE_BASE = 0xf000;
const ESCAPED = /[\uf000-\uf07f]/g;
const escaped = (char: string) => String.fromCharCode(ESCAPE_BASE + char.charCodeAt(0));
const unescaped = (char: string) => String.fromCharCode(char.charCodeAt(0) - ESCAPE_BASE);

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

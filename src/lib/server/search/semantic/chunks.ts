import { closesFence, fenceOpening } from '$lib/markdown-code';
import { markdownToSearchText } from '../text';

export interface Chunk {
	/** What gets embedded: the page title and headings above the text, then the text. */
	input: string;
	/** The text alone, shown as the result snippet. */
	text: string;
}

/** Long enough for a thought, short enough that one topic dominates it. */
export const MAX_CHUNK_LENGTH = 1200;

/**
 * Splits a page into the pieces that get an embedding each: one per
 * section (by heading), long sections cut at sentence ends. Each piece
 * carries its page title and headings, so "Täglich um 2 Uhr." under
 * "Sicherung" is still about backups.
 */
export function chunkPage(title: string, markdown: string): Chunk[] {
	const chunks: Chunk[] = [];
	const headings: string[] = [];
	let lines: string[] = [];
	let fence: string | null = null;

	const flush = () => {
		const text = markdownToSearchText(lines.join('\n'));
		lines = [];
		if (!text) return;
		const context = [title, ...headings.filter(Boolean)]
			.filter((part, i, all) => all.indexOf(part) === i)
			.join(' › ');
		for (const piece of splitText(text, MAX_CHUNK_LENGTH)) {
			chunks.push({ input: `${context}\n${piece}`, text: piece });
		}
	};

	for (const line of markdown.split('\n')) {
		if (fence) {
			if (closesFence(line, fence)) fence = null;
			lines.push(line);
			continue;
		}
		const opening = fenceOpening(line);
		if (opening) {
			fence = opening.marker;
			lines.push(line);
			continue;
		}
		const heading = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
		if (heading) {
			flush();
			const level = heading[1].length;
			headings.length = level - 1;
			headings[level - 1] = markdownToSearchText(heading[2]);
			continue;
		}
		lines.push(line);
	}
	flush();

	// A page with only a title can still be found by it.
	return chunks.length > 0 ? chunks : [{ input: title, text: '' }];
}

/** Cuts text into pieces of at most `max` characters, at sentence ends where possible. */
export function splitText(text: string, max: number): string[] {
	const pieces: string[] = [];
	let current = '';
	for (const sentence of text.split(/(?<=[.!?])\s+/)) {
		for (const part of hardSplit(sentence, max)) {
			if (current && current.length + 1 + part.length > max) {
				pieces.push(current);
				current = part;
			} else {
				current = current ? `${current} ${part}` : part;
			}
		}
	}
	if (current) pieces.push(current);
	return pieces;
}

/** A sentence longer than `max`, cut between words. */
function hardSplit(sentence: string, max: number): string[] {
	if (sentence.length <= max) return [sentence];
	const parts: string[] = [];
	let rest = sentence;
	while (rest.length > max) {
		const cut = rest.lastIndexOf(' ', max);
		const at = cut > 0 ? cut : max;
		parts.push(rest.slice(0, at));
		rest = rest.slice(at).trimStart();
	}
	if (rest) parts.push(rest);
	return parts;
}

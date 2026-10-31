import type { WikiLinkTarget } from './wiki-links';

/** `[[` and what's typed after it, up to the cursor — a wiki link being written. */
const OPEN_LINK = /\[\[([^[\]\n|#]{0,80})$/;

/**
 * The page name being typed in an unfinished `[[…` right before the
 * cursor, and how many characters back the `[[` starts; null if the
 * text there isn't one.
 */
export function openLinkQuery(textBefore: string): { query: string; length: number } | null {
	const match = OPEN_LINK.exec(textBefore);
	return match ? { query: match[1], length: match[0].length } : null;
}

/**
 * The pages that fit what's typed, best first: titles starting with it,
 * then titles containing it, then paths containing it — case-insensitive.
 * Everything (up to `limit`) when nothing's typed yet.
 */
export function suggestLinkTargets<T extends WikiLinkTarget>(
	query: string,
	pages: T[],
	limit = 8
): T[] {
	const q = query.trim().toLowerCase();
	const rank = (page: T) => {
		const title = page.title.toLowerCase();
		if (!q || title.startsWith(q)) return 0;
		if (title.includes(q)) return 1;
		if (page.path.toLowerCase().includes(q)) return 2;
		return -1;
	};
	return pages
		.map((page) => ({ page, rank: rank(page) }))
		.filter((entry) => entry.rank >= 0)
		.sort((a, b) => a.rank - b.rank || a.page.title.localeCompare(b.page.title))
		.slice(0, limit)
		.map((entry) => entry.page);
}

/**
 * What goes between `[[` and `]]` to link a page: its title — or, when
 * another page has the same title, its path with the title as label, so
 * the link is bound to the right one.
 */
export function linkTextFor(page: WikiLinkTarget, pages: WikiLinkTarget[]): string {
	const title = page.title.toLowerCase();
	const twins = pages.filter((p) => p.title.toLowerCase() === title).length;
	return twins > 1 ? `${page.path}|${page.title}` : page.title;
}

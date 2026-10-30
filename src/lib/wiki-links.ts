import { slugifyPath } from './slug';
import { transformOutsideCode } from './markdown-code';

export interface WikiLinkTarget {
	title: string;
	path: string;
}

// Milkdown's markdown serializer escapes a bare leading `[` (it would
// otherwise be ambiguous with link/image syntax), so `[[Name]]` typed in the
// editor is stored as `\[\[Name]]` — match both the escaped and the literal
// form (e.g. content authored outside the editor). In a table cell it also
// escapes the `|` before the label: `\[\[Name\|Label]]`.
const WIKI_LINK_PATTERN = /\\?\[\\?\[([^\]|]+?)(?:\\?\|([^\]]+?))?\\?\]\\?\]/g;

/** The id Milkdown gives a heading (defaultHeadingIdGenerator in its commonmark preset). */
function headingId(text: string): string {
	return text.toLowerCase().trim().replace(/\s+/g, '-');
}

/**
 * Resolves Obsidian-style `[[Page Name]]` (or `[[Page Name|Label]]`) links
 * into real markdown links. Matches by path first, then by title, both
 * case-insensitively — resolving by title (rather than baking in a path)
 * means a link keeps working if the target page is later moved to a
 * different folder, as long as its title doesn't change.
 * `[[Page Name#Heading]]` links to a heading on that page.
 *
 * Targets that don't exist yet still become a link — to that page's editor,
 * prefilled with the given name — so clicking one creates the page instead
 * of leading nowhere (matches the softer "just create a page for it" model
 * from the sidebar's "+" action).
 *
 * Code blocks and inline code are left as written.
 */
export function resolveWikiLinks(markdown: string, pages: WikiLinkTarget[]): string {
	const byPath = new Map(pages.map((p) => [p.path.toLowerCase(), p]));
	const byTitle = new Map(pages.map((p) => [p.title.toLowerCase(), p]));

	const resolveLink = (_match: string, rawTarget: string, rawLabel?: string) => {
		const target = rawTarget.trim();
		const label = (rawLabel ?? target).trim().replace(/[\\[\]]/g, '');
		const hashAt = target.indexOf('#');
		const name = (hashAt === -1 ? target : target.slice(0, hashAt)).trim();
		const heading = hashAt === -1 ? '' : target.slice(hashAt + 1).trim();
		const anchor = heading ? `#${encodeURIComponent(headingId(heading))}` : '';

		// [[#Heading]]: a heading on the same page.
		if (!name) return anchor ? `[${label}](${anchor})` : label;

		const key = name.toLowerCase();
		const found = byPath.get(key) ?? byTitle.get(key);
		if (found) {
			return `[${label}](/w/${found.path}${anchor})`;
		}

		const slug = slugifyPath(name);
		if (!slug) return label;

		const title = 'Seite existiert noch nicht – klicken zum Erstellen';
		return `[${label}](/w/${slug}/edit?title=${encodeURIComponent(name)} "${title}")`;
	};

	return transformOutsideCode(markdown, (text) => text.replace(WIKI_LINK_PATTERN, resolveLink));
}

/** A markdown link to a wiki page: `](/w/some/path)`, optionally with `#heading`. */
const PAGE_LINK_PATTERN = /\]\(\/w\/([^)\s#?]+)/g;

/**
 * The paths of the existing pages `markdown` links to — through
 * `[[wiki links]]` (resolved as in resolveWikiLinks) or plain markdown
 * links to /w/… — each once, in order of appearance. Links in code don't
 * count, nor do links to pages that don't exist.
 */
export function linkedPagePaths(markdown: string, pages: WikiLinkTarget[]): string[] {
	const byPath = new Map(pages.map((p) => [p.path.toLowerCase(), p]));
	const byTitle = new Map(pages.map((p) => [p.title.toLowerCase(), p]));
	const found = new Set<string>();

	transformOutsideCode(markdown, (text) => {
		for (const [, rawTarget] of text.matchAll(WIKI_LINK_PATTERN)) {
			const name = rawTarget.split('#')[0].trim().toLowerCase();
			const page = byPath.get(name) ?? byTitle.get(name);
			if (page) found.add(page.path);
		}
		for (const [, rawPath] of text.matchAll(PAGE_LINK_PATTERN)) {
			const page = byPath.get(decodeURIComponent(rawPath).toLowerCase());
			if (page) found.add(page.path);
		}
		return text;
	});

	return [...found];
}

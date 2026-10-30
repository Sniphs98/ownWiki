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
 * What `markdown` links to, as written and before resolving: the lowercased
 * name of each `[[wiki link]]` (without `#heading`), and `/` plus the
 * lowercased path of each markdown link to /w/…. Each once, in order of
 * appearance; links in code don't count. Stored per page (page_link), so
 * backlinks are found without reading every page.
 */
export function linkTargets(markdown: string): string[] {
	const found = new Set<string>();
	transformOutsideCode(markdown, (text) => {
		const links = [
			...[...text.matchAll(WIKI_LINK_PATTERN)].map((match) => ({
				at: match.index,
				target: match[1].split('#')[0].trim().toLowerCase()
			})),
			...[...text.matchAll(PAGE_LINK_PATTERN)].map((match) => ({
				at: match.index,
				target: `/${decodeURIComponent(match[1]).toLowerCase()}`
			}))
		];
		for (const { target } of links.sort((a, b) => a.at - b.at)) if (target) found.add(target);
		return text;
	});
	return [...found];
}

/**
 * Finds the page a link target (see linkTargets) leads to, as
 * resolveWikiLinks does: a wiki link by path, else by title; a /w/ link by
 * path only.
 */
export function linkTargetResolver(pages: WikiLinkTarget[]) {
	const byPath = new Map(pages.map((p) => [p.path.toLowerCase(), p]));
	const byTitle = new Map(pages.map((p) => [p.title.toLowerCase(), p]));
	return (target: string): string | undefined =>
		target.startsWith('/')
			? byPath.get(target.slice(1))?.path
			: (byPath.get(target) ?? byTitle.get(target))?.path;
}

/**
 * The paths of the existing pages `markdown` links to — through
 * `[[wiki links]]` or plain markdown links to /w/… — each once, in order of
 * appearance. Links in code don't count, nor do links to pages that don't
 * exist.
 */
export function linkedPagePaths(markdown: string, pages: WikiLinkTarget[]): string[] {
	const resolve = linkTargetResolver(pages);
	const paths = linkTargets(markdown).map(resolve);
	return [...new Set(paths.filter((path) => path !== undefined))];
}

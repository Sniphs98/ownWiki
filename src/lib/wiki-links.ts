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
 * What a page's links were bound to when it was saved: link target (as
 * linkTargets gives it) → the page it meant then. A bound link keeps
 * leading to that page when it is moved or renamed — and isn't taken over
 * by a new page that gets its old name. Only pages the reader may see.
 */
export type LinkBindings = Map<string, WikiLinkTarget>;

/**
 * Resolves Obsidian-style `[[Page Name]]` (or `[[Page Name|Label]]`) links
 * into real markdown links: through the page's `bindings` first, else by
 * path, then by title, both case-insensitively. A link without a label of
 * its own shows the page's current title, so a renamed page reads right.
 * `[[Page Name#Heading]]` links to a heading on that page. Markdown links to
 * /w/… that are bound lead to where the page is now.
 *
 * Targets that don't exist yet still become a link — to that page's editor,
 * prefilled with the given name — so clicking one creates the page instead
 * of leading nowhere (matches the softer "just create a page for it" model
 * from the sidebar's "+" action).
 *
 * Code blocks and inline code are left as written.
 */
export function resolveWikiLinks(
	markdown: string,
	pages: WikiLinkTarget[],
	bindings: LinkBindings = new Map()
): string {
	const byPath = new Map(pages.map((p) => [p.path.toLowerCase(), p]));
	const byTitle = new Map(pages.map((p) => [p.title.toLowerCase(), p]));

	const resolveLink = (_match: string, rawTarget: string, rawLabel?: string) => {
		const target = rawTarget.trim();
		const hashAt = target.indexOf('#');
		const name = (hashAt === -1 ? target : target.slice(0, hashAt)).trim();
		const heading = hashAt === -1 ? '' : target.slice(hashAt + 1).trim();
		const anchor = heading ? `#${encodeURIComponent(headingId(heading))}` : '';

		const key = name.toLowerCase();
		const found = name ? (bindings.get(key) ?? byPath.get(key) ?? byTitle.get(key)) : undefined;
		const written = found && !rawLabel ? `${found.title}${heading ? `#${heading}` : ''}` : null;
		const label = (written ?? rawLabel ?? target).trim().replace(/[\\[\]]/g, '');

		// [[#Heading]]: a heading on the same page.
		if (!name) return anchor ? `[${label}](${anchor})` : label;

		if (found) {
			return `[${label}](/w/${found.path}${anchor})`;
		}

		const slug = slugifyPath(name);
		if (!slug) return label;

		const title = 'Seite existiert noch nicht – klicken zum Erstellen';
		return `[${label}](/w/${slug}/edit?title=${encodeURIComponent(name)} "${title}")`;
	};

	return transformOutsideCode(markdown, (text) =>
		boundPageLinks(text, bindings).replace(WIKI_LINK_PATTERN, resolveLink)
	);
}

/** Markdown links to /w/… that are bound: to where the page is now. */
function boundPageLinks(text: string, bindings: LinkBindings) {
	return text.replace(PAGE_LINK_PATTERN, (match, rawPath: string) => {
		const bound = bindings.get(`/${decodeURIComponent(rawPath).toLowerCase()}`);
		return bound ? `](/w/${bound.path}` : match;
	});
}

/**
 * The markdown with every bound link written as the page is called now —
 * for the editor and for AI assistants, so the text catches up when a
 * linked page was renamed or moved. `[[Urlaub]]` → `[[Urlaubsantrag]]`, or
 * the path when two pages share the title. Labels, headings and Milkdown's
 * escaping stay as they are.
 */
export function refreshWikiLinks(
	markdown: string,
	pages: WikiLinkTarget[],
	bindings: LinkBindings
): string {
	if (bindings.size === 0) return markdown;
	const titles = new Map<string, number>();
	for (const page of pages) {
		const key = page.title.toLowerCase();
		titles.set(key, (titles.get(key) ?? 0) + 1);
	}

	const refresh = (match: string, rawTarget: string, rawLabel?: string) => {
		const [name, ...rest] = rawTarget.split('#');
		const bound = bindings.get(name.trim().toLowerCase());
		if (!bound) return match;
		const current = titles.get(bound.title.toLowerCase()) === 1 ? bound.title : bound.path;
		if (current.toLowerCase() === name.trim().toLowerCase()) return match;

		const target = rest.length ? `${current}#${rest.join('#')}` : current;
		const open = match.startsWith('\\[') ? '\\[\\[' : '[[';
		const separator = match.includes('\\|') ? '\\|' : '|';
		return `${open}${target}${rawLabel ? `${separator}${rawLabel}` : ''}]]`;
	};

	return transformOutsideCode(markdown, (text) =>
		boundPageLinks(text, bindings).replace(WIKI_LINK_PATTERN, refresh)
	);
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
 * Binds each link target to the page it means: the page it was bound to
 * before, as long as that still exists, else the page it resolves to now
 * (linkTargetResolver), else none yet — it binds once such a page exists.
 */
export function bindTargets(
	targets: string[],
	previous: Map<string, string | null>,
	pages: (WikiLinkTarget & { id: string })[]
): { target: string; pageId: string | null }[] {
	const ids = new Set(pages.map((p) => p.id));
	const idByPath = new Map(pages.map((p) => [p.path, p.id]));
	const resolve = linkTargetResolver(pages);
	return targets.map((target) => {
		const before = previous.get(target);
		const now = resolve(target);
		const pageId = before && ids.has(before) ? before : now ? (idByPath.get(now) ?? null) : null;
		return { target, pageId };
	});
}

/**
 * The paths of the existing pages `markdown` links to — through
 * `[[wiki links]]` or plain markdown links to /w/…, bound ones to where
 * their page is now — each once, in order of appearance. Links in code don't
 * count, nor do links to pages that don't exist.
 */
export function linkedPagePaths(
	markdown: string,
	pages: WikiLinkTarget[],
	bindings: LinkBindings = new Map()
): string[] {
	const resolve = linkTargetResolver(pages);
	const paths = linkTargets(markdown).map(
		(target) => bindings.get(target)?.path ?? resolve(target)
	);
	return [...new Set(paths.filter((path) => path !== undefined))];
}

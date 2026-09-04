import { slugifyPath } from './slug';

export interface WikiLinkTarget {
	title: string;
	path: string;
}

// Milkdown's markdown serializer escapes a bare leading `[` (it would
// otherwise be ambiguous with link/image syntax), so `[[Name]]` typed in the
// editor is stored as `\[\[Name]]` — match both the escaped and the literal
// form (e.g. content authored outside the editor).
const WIKI_LINK_PATTERN = /\\?\[\\?\[([^\]|]+?)(?:\|([^\]]+?))?\\?\]\\?\]/g;

/**
 * Resolves Obsidian-style `[[Page Name]]` (or `[[Page Name|Label]]`) links
 * into real markdown links. Matches by path first, then by title, both
 * case-insensitively — resolving by title (rather than baking in a path)
 * means a link keeps working if the target page is later moved to a
 * different folder, as long as its title doesn't change.
 *
 * Targets that don't exist yet still become a link — to that page's editor,
 * prefilled with the given name — so clicking one creates the page instead
 * of leading nowhere (matches the softer "just create a page for it" model
 * from the sidebar's "+" action).
 */
export function resolveWikiLinks(markdown: string, pages: WikiLinkTarget[]): string {
	const byPath = new Map(pages.map((p) => [p.path.toLowerCase(), p]));
	const byTitle = new Map(pages.map((p) => [p.title.toLowerCase(), p]));

	return markdown.replace(WIKI_LINK_PATTERN, (_match, rawTarget: string, rawLabel?: string) => {
		const target = rawTarget.trim();
		const label = (rawLabel ?? target).trim().replace(/[\\[\]]/g, '');
		const key = target.toLowerCase();

		const found = byPath.get(key) ?? byTitle.get(key);
		if (found) {
			return `[${label}](/w/${found.path})`;
		}

		const slug = slugifyPath(target);
		if (!slug) return label;

		const title = 'Seite existiert noch nicht – klicken zum Erstellen';
		return `[${label}](/w/${slug}/edit?title=${encodeURIComponent(target)} "${title}")`;
	});
}

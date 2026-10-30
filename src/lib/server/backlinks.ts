import {
	getPageWithLatestVersion,
	listPages,
	updateLinks,
	type PageSummary
} from '$lib/server/repo/pages';
import { linksOf, linksTo } from '$lib/server/repo/links';
import { linkTargetResolver, type LinkBindings } from '$lib/wiki-links';
import type { PageAccess } from '$lib/server/access';

/**
 * Fills the link table from every page's latest version — run at server
 * start, for pages saved before it existed or written around the app.
 * Links keep what they were bound to. From then on, saving a page keeps its
 * links up to date (repo/pages.ts).
 */
export async function rebuildLinks(): Promise<void> {
	for (const page of await listPages()) {
		const found = await getPageWithLatestVersion(page.path);
		if (found) await updateLinks(page.id, found.version.content);
	}
}

/**
 * What a page's links are bound to, as far as the reader may see those
 * pages (`readable`) — for resolveWikiLinks and refreshWikiLinks.
 */
export async function linkBindings(pageId: string, readable: PageSummary[]): Promise<LinkBindings> {
	const byId = new Map(readable.map((page) => [page.id, page]));
	const bindings: LinkBindings = new Map();
	for (const link of await linksOf(pageId)) {
		const page = link.pageId ? byId.get(link.pageId) : undefined;
		if (page) bindings.set(link.target, page);
	}
	return bindings;
}

/** The pages `access` may read whose latest version links to `path`. */
export async function findBacklinks(path: string, access: PageAccess): Promise<PageSummary[]> {
	const pages = await listPages();
	const page = pages.find((p) => p.path === path);
	if (!page) return [];

	// Bound to this page, or not bound yet but written in a way that leads
	// here (which page a name means depends on all pages).
	const key = page.path.toLowerCase();
	const candidates = await linksTo(page.id, [key, `/${key}`, page.title.toLowerCase()]);
	const resolve = linkTargetResolver(pages);
	const linking = new Set(
		candidates
			.filter((link) => link.pageId === page.id || resolve(link.target) === path)
			.map((link) => link.fromPageId)
	);
	return access.readable(pages.filter((p) => linking.has(p.id) && p.path !== path));
}

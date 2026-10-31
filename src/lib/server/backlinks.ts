import { getPageWithLatestVersion, listPages, type PageSummary } from '$lib/server/repo/pages';
import { linksTo, setLinks } from '$lib/server/repo/links';
import { linkTargetResolver, linkTargets } from '$lib/wiki-links';
import type { PageAccess } from '$lib/server/access';

/**
 * Fills the link table from every page's latest version — run at server
 * start, for pages saved before it existed or written around the app.
 * From then on, saving a page keeps its links up to date (repo/pages.ts).
 */
export async function rebuildLinks(): Promise<void> {
	for (const page of await listPages()) {
		const found = await getPageWithLatestVersion(page.path);
		if (found) await setLinks(page.id, linkTargets(found.version.content));
	}
}

/** The pages `access` may read whose latest version links to `path`. */
export async function findBacklinks(path: string, access: PageAccess): Promise<PageSummary[]> {
	const pages = await listPages();
	const page = pages.find((p) => p.path === path);
	if (!page) return [];

	// Every way of writing a link that may lead here; which page it really
	// leads to depends on all pages (a title can also be another page's path).
	const key = page.path.toLowerCase();
	const candidates = await linksTo([key, `/${key}`, page.title.toLowerCase()]);
	const resolve = linkTargetResolver(pages);
	const linking = new Set(
		candidates.filter((link) => resolve(link.target) === path).map((link) => link.pageId)
	);
	return access.readable(pages.filter((p) => linking.has(p.id) && p.path !== path));
}

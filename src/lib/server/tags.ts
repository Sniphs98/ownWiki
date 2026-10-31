import { listPages, type PageSummary } from '$lib/server/repo/pages';
import { listPageTags } from '$lib/server/repo/tags';
import type { PageAccess } from '$lib/server/access';

/** Every tag with the pages `access` may read that have it; tags without such pages are left out. */
export async function readableTags(access: PageAccess): Promise<Map<string, PageSummary[]>> {
	const [pages, pageTags] = await Promise.all([listPages(), listPageTags()]);
	const readable = new Map(access.readable(pages).map((page) => [page.id, page]));
	const tags = new Map<string, PageSummary[]>();
	for (const { pageId, tag } of pageTags) {
		const page = readable.get(pageId);
		if (!page) continue;
		tags.set(tag, [...(tags.get(tag) ?? []), page]);
	}
	return tags;
}

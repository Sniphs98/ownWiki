import { error } from '@sveltejs/kit';
import { getPageWithLatestVersion, listPages } from '$lib/server/repo/pages';
import { getCover } from '$lib/server/repo/covers';
import { resolveWikiLinks } from '$lib/wiki-links';
import { requireRead } from '$lib/server/access';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { access } = event.locals;
	requireRead(access, event.params.path);
	const result = await getPageWithLatestVersion(event.params.path);
	if (!result) error(404, 'Seite nicht gefunden');

	const [allPages, cover] = await Promise.all([listPages(), getCover(result.page.id)]);
	// Links to pages the visitor can't see read like links to missing ones.
	const pages = access.readable(allPages);

	return {
		page: result.page,
		version: {
			...result.version,
			content: resolveWikiLinks(result.version.content, pages)
		},
		/** The page's PDF title page (pdf-export-dialog.svelte), if it has one. */
		cover,
		canEdit: access.canEdit(result.page.path)
	};
};

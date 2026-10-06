import { error } from '@sveltejs/kit';
import { getPageWithLatestVersion, listPages } from '$lib/server/repo/pages';
import { resolveWikiLinks } from '$lib/wiki-links';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const result = await getPageWithLatestVersion(event.params.path);
	if (!result) error(404, 'Seite nicht gefunden');

	const pages = await listPages();

	return {
		page: result.page,
		version: {
			...result.version,
			content: resolveWikiLinks(result.version.content, pages)
		}
	};
};

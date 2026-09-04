import { error } from '@sveltejs/kit';
import { getPageWithLatestVersion } from '$lib/server/repo/pages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const result = await getPageWithLatestVersion(event.params.path);
	if (!result) error(404, 'Seite nicht gefunden');

	return {
		page: result.page,
		version: result.version
	};
};

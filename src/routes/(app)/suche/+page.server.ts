import { searchPages } from '$lib/server/search';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';
	return {
		query,
		hits: query.length >= 2 ? locals.access.readable(await searchPages(query)) : []
	};
};

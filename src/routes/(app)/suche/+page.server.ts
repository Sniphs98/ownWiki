import { searchPages } from '$lib/server/search';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';
	return {
		query,
		hits: query.length >= 2 ? await searchPages(query) : []
	};
};

import { readableTags } from '$lib/server/tags';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const tags = await readableTags(locals.access);
	return {
		tags: [...tags].map(([tag, pages]) => ({ tag, count: pages.length }))
	};
};

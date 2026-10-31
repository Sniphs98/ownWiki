import { readableTags } from '$lib/server/tags';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const pages = (await readableTags(locals.access)).get(params.tag) ?? [];
	return {
		tag: params.tag,
		pages: pages.map(({ path, title }) => ({ path, title }))
	};
};

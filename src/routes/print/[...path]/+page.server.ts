import { error } from '@sveltejs/kit';
import { resolvePrintablePages } from '$lib/server/pdf/printable-pages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const scope = event.url.searchParams.get('scope');
	const result = await resolvePrintablePages(event.params.path, scope);
	if (!result) error(404, 'Seite nicht gefunden');
	return result;
};

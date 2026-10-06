import { error } from '@sveltejs/kit';
import { resolveAllPrintablePages } from '$lib/server/pdf/printable-pages';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const result = await resolveAllPrintablePages();
	if (result.pages.length === 0) error(404, 'Noch keine Seiten vorhanden');
	return result;
};

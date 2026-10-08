import { error } from '@sveltejs/kit';
import { resolveAllPrintablePages } from '$lib/server/pdf/printable-pages';
import { wantsToc } from '$lib/pdf-toc-setting.svelte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const result = await resolveAllPrintablePages();
	if (result.pages.length === 0) error(404, 'Noch keine Seiten vorhanden');
	// adapter-node derives the URL from ORIGIN, so this is the public origin.
	return { ...result, linkOrigin: event.url.origin, toc: wantsToc(event.url) };
};

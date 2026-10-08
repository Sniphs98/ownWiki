import { error } from '@sveltejs/kit';
import { resolvePrintablePages } from '$lib/server/pdf/printable-pages';
import { wantsToc } from '$lib/pdf-toc-setting.svelte';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const scope = event.url.searchParams.get('scope');
	const result = await resolvePrintablePages(event.params.path, scope, {
		withCover: event.url.searchParams.get('cover') === '1'
	});
	if (!result) error(404, 'Seite nicht gefunden');
	// adapter-node derives the URL from ORIGIN, so this is the public origin.
	return { ...result, linkOrigin: event.url.origin, toc: wantsToc(event.url) };
};

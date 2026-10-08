import { error } from '@sveltejs/kit';
import { getPageWithLatestVersion } from '$lib/server/repo/pages';
import { generatePdfOrFail } from '$lib/server/pdf/generate-pdf';
import { wantsToc } from '$lib/pdf-toc-setting.svelte';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const path = event.params.path;
	const scope = event.url.searchParams.get('scope');

	const result = await getPageWithLatestVersion(path);
	if (!result) error(404, 'Seite nicht gefunden');

	const query = new URLSearchParams();
	if (scope === 'subtree') query.set('scope', 'subtree');
	if (wantsToc(event.url)) query.set('toc', '1');
	const printUrl = `/print/${path}${query.size > 0 ? `?${query}` : ''}`;
	const pdf = await generatePdfOrFail(printUrl, event.url);
	const filename = `${result.page.path.replace(/\//g, '-')}.pdf`;

	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="${filename}"`
		}
	});
};

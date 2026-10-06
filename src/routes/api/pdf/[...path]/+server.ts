import { error } from '@sveltejs/kit';
import { getPageWithLatestVersion } from '$lib/server/repo/pages';
import { generatePdfOrFail } from '$lib/server/pdf/generate-pdf';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const path = event.params.path;
	const scope = event.url.searchParams.get('scope');

	const result = await getPageWithLatestVersion(path);
	if (!result) error(404, 'Seite nicht gefunden');

	const printUrl = `/print/${path}${scope === 'subtree' ? '?scope=subtree' : ''}`;
	const pdf = await generatePdfOrFail(printUrl, event.url);
	const filename = `${result.page.path.replace(/\//g, '-')}.pdf`;

	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="${filename}"`
		}
	});
};

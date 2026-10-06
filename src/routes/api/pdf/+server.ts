import { error } from '@sveltejs/kit';
import { listPages } from '$lib/server/repo/pages';
import { generatePdfOrFail } from '$lib/server/pdf/generate-pdf';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const allPages = await listPages();
	if (allPages.length === 0) error(404, 'Noch keine Seiten vorhanden');

	const pdf = await generatePdfOrFail('/print', event.url);

	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="ownwiki-export.pdf"`
		}
	});
};

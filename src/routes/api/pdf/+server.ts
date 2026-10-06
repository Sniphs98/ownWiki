import { error } from '@sveltejs/kit';
import { listPages } from '$lib/server/repo/pages';
import { generatePdf } from '$lib/server/pdf/generate-pdf';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const allPages = await listPages();
	if (allPages.length === 0) error(404, 'Noch keine Seiten vorhanden');

	const pdf = await generatePdf('/print');

	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="ownwiki-export.pdf"`
		}
	});
};

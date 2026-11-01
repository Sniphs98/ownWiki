import { error } from '@sveltejs/kit';
import { listPages } from '$lib/server/repo/pages';
import { generatePdfOrFail } from '$lib/server/pdf/generate-pdf';
import { wantsToc } from '$lib/pdf-toc-setting.svelte';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const pages = event.locals.access.readable(await listPages());
	if (pages.length === 0) error(404, 'Noch keine Seiten vorhanden');

	// Rendered as the person asking: with exactly the pages they may read.
	const pdf = await generatePdfOrFail(
		wantsToc(event.url) ? '/print?toc=1' : '/print',
		event.url,
		event.locals.user?.id
	);

	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="wiki-export.pdf"`
		}
	});
};

import { error } from '@sveltejs/kit';
import { getPageWithLatestVersion, listPages } from '$lib/server/repo/pages';
import { resolveWikiLinks } from '$lib/wiki-links';
import { generatePdf } from '$lib/server/pdf/generate-pdf';
import type { PrintablePage } from '$lib/server/pdf/render-html';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const allPages = await listPages();
	if (allPages.length === 0) error(404, 'Noch keine Seiten vorhanden');

	const printablePages: PrintablePage[] = [];
	for (const target of [...allPages].sort((a, b) => a.path.localeCompare(b.path))) {
		const found = await getPageWithLatestVersion(target.path);
		if (!found) continue;
		printablePages.push({
			title: found.version.title,
			path: found.page.path,
			content: resolveWikiLinks(found.version.content, allPages)
		});
	}

	const pdf = await generatePdf(printablePages, 'ownWiki');

	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="ownwiki-export.pdf"`
		}
	});
};

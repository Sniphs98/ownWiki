import { error } from '@sveltejs/kit';
import { getPageWithLatestVersion, listPages } from '$lib/server/repo/pages';
import { resolveWikiLinks } from '$lib/wiki-links';
import { generatePdf } from '$lib/server/pdf/generate-pdf';
import type { PrintablePage } from '$lib/server/pdf/render-html';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const path = event.params.path;
	const scope = event.url.searchParams.get('scope');

	const result = await getPageWithLatestVersion(path);
	if (!result) error(404, 'Seite nicht gefunden');

	const allPages = await listPages();

	const targets =
		scope === 'subtree'
			? allPages.filter((p) => p.path === path || p.path.startsWith(`${path}/`))
			: [{ path: result.page.path, title: result.page.title }];

	const printablePages: PrintablePage[] = [];
	for (const target of targets.sort((a, b) => a.path.localeCompare(b.path))) {
		const found =
			target.path === result.page.path ? result : await getPageWithLatestVersion(target.path);
		if (!found) continue;
		printablePages.push({
			title: found.version.title,
			path: found.page.path,
			content: resolveWikiLinks(found.version.content, allPages)
		});
	}

	const pdf = await generatePdf(printablePages, result.page.title);
	const filename = `${result.page.path.replace(/\//g, '-')}.pdf`;

	return new Response(new Uint8Array(pdf), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="${filename}"`
		}
	});
};

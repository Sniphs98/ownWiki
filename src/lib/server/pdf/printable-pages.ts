import { getPageWithLatestVersion, listPages } from '$lib/server/repo/pages';
import { getAttachment } from '$lib/server/repo/attachments';
import { getCover } from '$lib/server/repo/covers';
import { resolveWikiLinks } from '$lib/wiki-links';

export interface PrintablePage {
	title: string;
	path: string;
	content: string;
	versionNumber: number;
	updatedAt: Date;
}

export interface PrintableResult {
	wikiTitle: string;
	pages: PrintablePage[];
	/** The page's own title page (markdown), replacing the generated cover. */
	cover?: string;
}

const ATTACHMENT_MD_PATTERN = /\]\(\/api\/files\/([a-f0-9-]{36})\)/g;

/**
 * Inlines our own /api/files/<id> image references as data: URIs directly in
 * the markdown source, before it's handed to Crepe. Keeps the print route
 * fully self-contained (no authenticated fetch back to /api/files needed
 * from the PDF generator's loopback browser context) — mirrors the image
 * inlining the previous server-side renderer did on its rendered HTML.
 */
async function inlineAttachmentImages(markdown: string): Promise<string> {
	const ids = [...markdown.matchAll(ATTACHMENT_MD_PATTERN)].map((m) => m[1]);
	if (ids.length === 0) return markdown;

	const unique = [...new Set(ids)];
	const replacements = new Map<string, string>();

	await Promise.all(
		unique.map(async (id) => {
			const file = await getAttachment(id);
			// Only images: a link to some other file stays a link.
			if (!file || !file.mimeType.startsWith('image/')) return;
			replacements.set(id, `data:${file.mimeType};base64,${file.data.toString('base64')}`);
		})
	);

	return markdown.replace(ATTACHMENT_MD_PATTERN, (match, id: string) => {
		const dataUri = replacements.get(id);
		return dataUri ? `](${dataUri})` : match;
	});
}

/**
 * Resolves the page (or, with scope=subtree, the page and all its
 * descendants) to print/export, with wiki-links resolved and attachment
 * images inlined. Shared by the /print preview route and the /api/pdf
 * export endpoint so both produce identical content.
 */
export async function resolvePrintablePages(
	path: string,
	scope: string | null,
	{ withCover = false }: { withCover?: boolean } = {}
): Promise<PrintableResult | null> {
	const result = await getPageWithLatestVersion(path);
	if (!result) return null;

	const allPages = await listPages();
	const targets =
		scope === 'subtree'
			? allPages.filter((p) => p.path === path || p.path.startsWith(`${path}/`))
			: [{ path: result.page.path, title: result.page.title }];

	const pages: PrintablePage[] = [];
	for (const target of targets.sort((a, b) => a.path.localeCompare(b.path))) {
		const found =
			target.path === result.page.path ? result : await getPageWithLatestVersion(target.path);
		if (!found) continue;
		const withLinks = resolveWikiLinks(found.version.content, allPages);
		const withImages = await inlineAttachmentImages(withLinks);
		pages.push({
			title: found.version.title,
			path: found.page.path,
			content: withImages,
			versionNumber: found.version.versionNumber,
			updatedAt: found.page.updatedAt
		});
	}

	const cover = withCover ? await getCover(result.page.id) : null;
	return {
		pages,
		wikiTitle: result.page.title,
		cover: cover ? await inlineAttachmentImages(resolveWikiLinks(cover, allPages)) : undefined
	};
}

/** Every page in the wiki, for the "export everything" PDF. */
export async function resolveAllPrintablePages(): Promise<PrintableResult> {
	const allPages = await listPages();

	const pages: PrintablePage[] = [];
	for (const target of [...allPages].sort((a, b) => a.path.localeCompare(b.path))) {
		const found = await getPageWithLatestVersion(target.path);
		if (!found) continue;
		const withLinks = resolveWikiLinks(found.version.content, allPages);
		const withImages = await inlineAttachmentImages(withLinks);
		pages.push({
			title: found.version.title,
			path: found.page.path,
			content: withImages,
			versionNumber: found.version.versionNumber,
			updatedAt: found.page.updatedAt
		});
	}

	return { pages, wikiTitle: 'ownWiki' };
}

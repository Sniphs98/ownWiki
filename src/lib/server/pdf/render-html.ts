import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { getAttachment } from '$lib/server/repo/attachments';

export interface PrintablePage {
	title: string;
	path: string;
	content: string;
}

const ATTACHMENT_SRC_PATTERN = /src="\/api\/files\/([a-f0-9-]{36})"/g;

/**
 * Inlines our own /api/files/<id> image references as data: URIs by
 * reading the attachment straight from the DB. Avoids the exported PDF
 * needing network access back to the app (which may not even be
 * reachable at its public origin from inside the container) and sidesteps
 * Playwright's page.setContent() not resolving relative URLs at all
 * (it has no document origin).
 */
async function inlineAttachmentImages(html: string): Promise<string> {
	const ids = [...html.matchAll(ATTACHMENT_SRC_PATTERN)].map((m) => m[1]);
	if (ids.length === 0) return html;

	const unique = [...new Set(ids)];
	const replacements = new Map<string, string>();

	await Promise.all(
		unique.map(async (id) => {
			const file = await getAttachment(id);
			if (!file) return;
			const base64 = file.data.toString('base64');
			replacements.set(id, `data:${file.mimeType};base64,${base64}`);
		})
	);

	return html.replace(ATTACHMENT_SRC_PATTERN, (match, id: string) => {
		const dataUri = replacements.get(id);
		return dataUri ? `src="${dataUri}"` : match;
	});
}

function sanitize(html: string): string {
	return sanitizeHtml(html, {
		allowedTags: [
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'p',
			'br',
			'hr',
			'strong',
			'em',
			'del',
			's',
			'a',
			'ul',
			'ol',
			'li',
			'blockquote',
			'code',
			'pre',
			'img',
			'table',
			'thead',
			'tbody',
			'tr',
			'th',
			'td',
			'input',
			'span',
			'div'
		],
		allowedAttributes: {
			a: ['href', 'title'],
			img: ['src', 'alt', 'title'],
			input: ['type', 'checked', 'disabled'],
			code: ['class'],
			span: ['class'],
			div: ['class'],
			'*': ['id']
		},
		allowedSchemes: ['http', 'https', 'data', 'mailto'],
		disallowedTagsMode: 'discard'
	});
}

const PRINT_STYLES = `
	@page { margin: 20mm 16mm; }
	body {
		font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
		color: #1a1a1a;
		line-height: 1.6;
		font-size: 11pt;
		orphans: 3;
		widows: 3;
	}
	h1, h2, h3, h4, h5, h6 {
		font-weight: 600;
		line-height: 1.25;
		margin: 1.4em 0 0.5em;
		break-after: avoid;
		break-inside: avoid;
	}
	h1 { font-size: 22pt; border-bottom: 1px solid #ddd; padding-bottom: 0.3em; }
	h2 { font-size: 16pt; }
	h3 { font-size: 13pt; }
	p, ul, ol, blockquote, table { margin: 0.6em 0; }
	a { color: #2563eb; text-decoration: none; }
	code { font-family: 'Cascadia Code', Consolas, monospace; background: #f1f1f1; padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
	pre {
		background: #f5f5f5;
		padding: 0.8em 1em;
		border-radius: 6px;
		overflow-x: auto;
		break-inside: avoid;
	}
	pre code { background: none; padding: 0; }
	blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 1em; color: #555; break-inside: avoid; }
	table { border-collapse: collapse; width: 100%; break-inside: auto; }
	tr { break-inside: avoid; break-after: auto; }
	thead { display: table-header-group; }
	th, td { border: 1px solid #ddd; padding: 0.4em 0.7em; text-align: left; }
	img { max-width: 100%; break-inside: avoid; }
	li { break-inside: avoid; }
	.wiki-chapter { page-break-before: always; }
	.wiki-chapter:first-child { page-break-before: avoid; }
	.wiki-chapter-title { font-size: 22pt; font-weight: 700; margin: 0 0 0.2em; }
	.wiki-chapter-path { color: #888; font-size: 9pt; margin: 0 0 1.5em; font-family: monospace; }
	.wiki-cover { text-align: center; padding-top: 30vh; page-break-after: always; }
	.wiki-cover h1 { font-size: 28pt; border: none; }
	.wiki-cover p { color: #888; }
`;

export async function renderPrintableHtml(
	pages: PrintablePage[],
	wikiTitle: string
): Promise<string> {
	const chapters = await Promise.all(
		pages.map(async (page) => {
			const rawHtml = await marked.parse(page.content, { async: true, gfm: true });
			const clean = sanitize(rawHtml);
			const withImages = await inlineAttachmentImages(clean);
			return { title: page.title, path: page.path, html: withImages };
		})
	);

	const isMulti = pages.length > 1;
	const cover = isMulti
		? `<div class="wiki-cover"><h1>${escapeHtml(wikiTitle)}</h1><p>Exportiert am ${new Date().toLocaleString('de-DE')}</p></div>`
		: '';

	const body = chapters
		.map(
			(c) => `
				<div class="wiki-chapter">
					${isMulti ? `<div class="wiki-chapter-path">/w/${escapeHtml(c.path)}</div><h1 class="wiki-chapter-title">${escapeHtml(c.title)}</h1>` : ''}
					${c.html}
				</div>
			`
		)
		.join('\n');

	return `<!doctype html>
<html lang="de">
<head>
	<meta charset="utf-8" />
	<title>${escapeHtml(wikiTitle)}</title>
	<style>${PRINT_STYLES}</style>
</head>
<body>
	${cover}
	${body}
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

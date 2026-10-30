import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { findBacklinks } from '$lib/server/backlinks';
import { getPageWithLatestVersion, listPages } from '$lib/server/repo/pages';
import { searchPages } from '$lib/server/search';
import { linkedPagePaths } from '$lib/wiki-links';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/** Tool results are JSON, as text — the form ChatGPT's `search` and `fetch` expect. */
const json = (value: unknown) => ({
	content: [{ type: 'text' as const, text: JSON.stringify(value) }]
});

const notFound = (path: string) => ({
	content: [{ type: 'text' as const, text: `Keine Seite unter "${path}".` }],
	isError: true
});

/**
 * The wiki as an MCP server, for AI assistants. A page's id is its path
 * (e.g. `personal/kuendigung`); `origin` makes the links to it absolute.
 * `search` and `fetch` follow the shape ChatGPT's connectors and deep
 * research expect.
 */
export function createWikiMcpServer(origin: string) {
	const server = new McpServer(
		{ name: 'ownwiki', version: '1.0.0' },
		{
			instructions:
				'ownWiki ist das persönliche Wiki (Second Brain) des Nutzers, in Markdown. ' +
				'Seiten werden über ihren Pfad angesprochen. Erst mit `search` suchen, dann mit ' +
				'`fetch` lesen. `[[Seitenname]]` im Text ist ein Link auf eine andere Seite.'
		}
	);
	const pageUrl = (path: string) => `${origin}/w/${path}`;

	server.registerTool(
		'search',
		{
			title: 'Wiki durchsuchen',
			description:
				'Volltextsuche über Titel, Pfade und Text aller Wiki-Seiten. Alle Suchwörter müssen ' +
				'vorkommen; Wortformen werden mitgefunden. Gibt die passendsten Seiten zurück, ' +
				'mit Textausschnitt. Die `id` eines Treffers ist für `fetch`.',
			inputSchema: { query: z.string().min(1).describe('Suchwörter') },
			annotations: READ_ONLY
		},
		async ({ query }) => {
			const hits = await searchPages(query, 20);
			return json({
				results: hits.map((hit) => ({
					id: hit.path,
					title: hit.title,
					url: pageUrl(hit.path),
					text: hit.snippet.map((part) => part.text).join('')
				}))
			});
		}
	);

	server.registerTool(
		'fetch',
		{
			title: 'Seite lesen',
			description:
				'Liest eine Wiki-Seite vollständig als Markdown, mit den Pfaden der Seiten, auf die ' +
				'sie verlinkt.',
			inputSchema: { id: z.string().min(1).describe('Pfad der Seite, z. B. personal/kuendigung') },
			annotations: READ_ONLY
		},
		async ({ id }) => {
			const found = await getPageWithLatestVersion(id);
			if (!found) return notFound(id);
			const pages = await listPages();
			return json({
				id: found.page.path,
				title: found.version.title,
				text: found.version.content,
				url: pageUrl(found.page.path),
				metadata: {
					version: found.version.versionNumber,
					updatedAt: found.page.updatedAt.toISOString(),
					linksTo: linkedPagePaths(found.version.content, pages)
				}
			});
		}
	);

	server.registerTool(
		'list_pages',
		{
			title: 'Seiten auflisten',
			description:
				'Listet die Seiten des Wikis (Pfad, Titel, letzte Änderung), nach Pfad sortiert. ' +
				'Mit `prefix` nur einen Bereich, z. B. "projekte" für projekte/… .',
			inputSchema: {
				prefix: z.string().optional().describe('Nur Seiten unter diesem Pfad')
			},
			annotations: READ_ONLY
		},
		async ({ prefix }) => {
			const base = prefix?.replace(/^\/+|\/+$/g, '');
			const pages = (await listPages()).filter(
				(p) => !base || p.path === base || p.path.startsWith(`${base}/`)
			);
			return json({
				pages: pages.map((p) => ({
					id: p.path,
					title: p.title,
					updatedAt: p.updatedAt.toISOString()
				}))
			});
		}
	);

	server.registerTool(
		'get_backlinks',
		{
			title: 'Backlinks',
			description: 'Die Seiten, die auf eine Seite verlinken – um verwandte Notizen zu finden.',
			inputSchema: { id: z.string().min(1).describe('Pfad der Seite') },
			annotations: READ_ONLY
		},
		async ({ id }) => {
			if (!(await getPageWithLatestVersion(id))) return notFound(id);
			const pages = await findBacklinks(id);
			return json({
				backlinks: pages.map((p) => ({ id: p.path, title: p.title, url: pageUrl(p.path) }))
			});
		}
	);

	return server;
}

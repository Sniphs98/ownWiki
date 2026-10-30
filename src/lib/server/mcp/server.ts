import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { findBacklinks } from '$lib/server/backlinks';
import type { PageAccess } from '$lib/server/access';
import {
	addPageVersion,
	createPage,
	getPageWithLatestVersion,
	listPages,
	PageConflictError
} from '$lib/server/repo/pages';
import { searchPages } from '$lib/server/search';
import { titleFromMarkdown } from '$lib/page-title';
import { slugifyPath } from '$lib/slug';
import { linkedPagePaths } from '$lib/wiki-links';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
// Writes never lose anything: every change is a new version in the history.
const WRITES = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

/** Tool results are JSON, as text — the form ChatGPT's `search` and `fetch` expect. */
const json = (value: unknown) => ({
	content: [{ type: 'text' as const, text: JSON.stringify(value) }]
});

const failure = (text: string) => ({
	content: [{ type: 'text' as const, text }],
	isError: true
});

const notFound = (path: string) => failure(`Keine Seite unter "${path}".`);

const notAllowed = (path: string) =>
	failure(`Du darfst "${path}" nicht bearbeiten – dafür fehlen die Rechte in diesem Bereich.`);

const conflict = (latest: number) =>
	failure(
		`Die Seite wurde inzwischen geändert (jetzt Version ${latest}). ` +
			'Lies sie mit `fetch` neu und wende deine Änderung auf den aktuellen Stand an.'
	);

/** Who is writing: the person who connected the assistant, and the assistant's name. */
export interface McpActor {
	userId: string;
	/** What the person may do — the assistant may do exactly the same. */
	access: PageAccess;
	via: string;
}

const CHANGE_SUMMARY = z
	.string()
	.max(200)
	.optional()
	.describe('Kurz, was geändert wurde und warum – erscheint im Versionsverlauf');

/**
 * The wiki as an MCP server, for AI assistants. A page's id is its path
 * (e.g. `personal/kuendigung`); `origin` makes the links to it absolute.
 * `search` and `fetch` follow the shape ChatGPT's connectors and deep
 * research expect. Writes are saved as `actor`, like an edit in the editor.
 */
export function createWikiMcpServer(origin: string, actor: McpActor) {
	const server = new McpServer(
		{ name: 'ownwiki', version: '1.0.0' },
		{
			instructions:
				'ownWiki ist das persönliche Wiki (Second Brain) des Nutzers, in Markdown. ' +
				'Seiten werden über ihren Pfad angesprochen. Erst mit `search` suchen, dann mit ' +
				'`fetch` lesen. `[[Seitenname]]` im Text ist ein Link auf eine andere Seite. ' +
				'Die erste Zeile einer Seite ist eine Überschrift (`# Titel`) und ihr Titel. ' +
				'Jede Änderung wird als neue Version gespeichert und lässt sich wiederherstellen.'
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
			const hits = actor.access.readable(await searchPages(query, 20));
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
			const found = actor.access.canRead(id) ? await getPageWithLatestVersion(id) : null;
			if (!found) return notFound(id);
			const pages = actor.access.readable(await listPages());
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
			const pages = actor.access
				.readable(await listPages())
				.filter((p) => !base || p.path === base || p.path.startsWith(`${base}/`));
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
			if (!actor.access.canRead(id) || !(await getPageWithLatestVersion(id))) return notFound(id);
			const pages = await findBacklinks(id, actor.access);
			return json({
				backlinks: pages.map((p) => ({ id: p.path, title: p.title, url: pageUrl(p.path) }))
			});
		}
	);

	server.registerTool(
		'create_page',
		{
			title: 'Seite anlegen',
			description:
				'Legt eine neue Wiki-Seite an. Der Text beginnt mit einer Überschrift (`# Titel`), ' +
				'die zum Titel der Seite wird. Der Pfad ordnet die Seite ein, z. B. ' +
				'`projekte/website/relaunch`; vorher mit `list_pages` passende Bereiche ansehen.',
			inputSchema: {
				id: z.string().min(1).describe('Pfad der neuen Seite, z. B. projekte/relaunch'),
				content: z.string().min(1).describe('Markdown, beginnend mit `# Titel`'),
				change_summary: CHANGE_SUMMARY
			},
			annotations: WRITES
		},
		async ({ id, content, change_summary }) => {
			const path = slugifyPath(id);
			if (!path) return failure(`"${id}" ist kein gültiger Pfad.`);
			if (!actor.access.canEdit(path)) return notAllowed(path);
			const title = titleFromMarkdown(content).slice(0, 200);
			if (!title) return failure('Beginne den Text mit einer Überschrift (`# Titel`).');

			try {
				await createPage({
					path,
					title,
					content,
					authorId: actor.userId,
					via: actor.via,
					changeSummary: change_summary
				});
			} catch (err) {
				if (!(err instanceof PageConflictError)) throw err;
				return failure(
					`Unter "${path}" gibt es schon eine Seite. Ändere sie mit \`update_page\` ` +
						'oder `append_to_page`, oder wähle einen anderen Pfad.'
				);
			}
			return json({ id: path, title, version: 1, url: pageUrl(path) });
		}
	);

	server.registerTool(
		'update_page',
		{
			title: 'Seite ändern',
			description:
				'Ersetzt den ganzen Text einer Seite. Erst mit `fetch` lesen und dessen ' +
				'`metadata.version` als `base_version` mitgeben – hat jemand die Seite inzwischen ' +
				'geändert, schlägt das fehl, statt seine Änderung zu überschreiben. Nur zum ' +
				'Ergänzen besser `append_to_page`.',
			inputSchema: {
				id: z.string().min(1).describe('Pfad der Seite'),
				content: z.string().min(1).describe('Der komplette neue Text, als Markdown'),
				base_version: z.number().int().positive().describe('Version, auf der die Änderung beruht'),
				change_summary: CHANGE_SUMMARY
			},
			annotations: WRITES
		},
		async ({ id, content, base_version, change_summary }) => {
			const found = actor.access.canRead(id) ? await getPageWithLatestVersion(id) : null;
			if (!found) return notFound(id);
			if (!actor.access.canEdit(id)) return notAllowed(id);
			// As in the editor: without a heading on top, the page keeps its title.
			const title = titleFromMarkdown(content).slice(0, 200) || found.version.title;

			try {
				const version = await addPageVersion({
					pageId: found.page.id,
					title,
					content,
					baseVersion: base_version,
					authorId: actor.userId,
					via: actor.via,
					changeSummary: change_summary
				});
				return json({ id, title, version, url: pageUrl(id) });
			} catch (err) {
				if (err instanceof PageConflictError) return conflict(err.latestVersion);
				throw err;
			}
		}
	);

	server.registerTool(
		'append_to_page',
		{
			title: 'An Seite anhängen',
			description:
				'Hängt Markdown ans Ende einer Seite an, z. B. eine neue Notiz, einen Abschnitt ' +
				'(`## …`) oder Listenpunkte. Der vorhandene Text bleibt unverändert.',
			inputSchema: {
				id: z.string().min(1).describe('Pfad der Seite'),
				content: z.string().min(1).describe('Anzuhängendes Markdown'),
				change_summary: CHANGE_SUMMARY
			},
			annotations: WRITES
		},
		async ({ id, content, change_summary }) => {
			const found = actor.access.canRead(id) ? await getPageWithLatestVersion(id) : null;
			if (!found) return notFound(id);
			if (!actor.access.canEdit(id)) return notAllowed(id);

			try {
				const version = await addPageVersion({
					pageId: found.page.id,
					title: found.version.title,
					content: `${found.version.content.trimEnd()}\n\n${content.trim()}\n`,
					// Appends to exactly the text just read, never over a newer save.
					baseVersion: found.version.versionNumber,
					authorId: actor.userId,
					via: actor.via,
					changeSummary: change_summary
				});
				return json({ id, version, url: pageUrl(id) });
			} catch (err) {
				if (err instanceof PageConflictError) return conflict(err.latestVersion);
				throw err;
			}
		}
	);

	return server;
}

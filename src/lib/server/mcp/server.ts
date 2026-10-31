import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { findBacklinks, linkBindings } from '$lib/server/backlinks';
import { listPageTags, setTags, tagsOf } from '$lib/server/repo/tags';
import { readableTags } from '$lib/server/tags';
import { addNote, deleteNote, listNotes } from '$lib/server/repo/inbox';
import { fileNote, MAX_NOTE_LENGTH } from '$lib/server/inbox';
import { movedPath, movePage } from '$lib/server/move';
import { authMode } from '$lib/server/auth-mode';
import { parseTags } from '$lib/tags';
import type { PageAccess } from '$lib/server/access';
import {
	addPageVersion,
	createPage,
	getPageWithLatestVersion,
	listPages,
	PageConflictError
} from '$lib/server/repo/pages';
import { searchPages, semanticSearchEnabled } from '$lib/server/search';
import { titleFromMarkdown } from '$lib/page-title';
import { slugifyPath } from '$lib/slug';
import { linkedPagePaths, refreshWikiLinks } from '$lib/wiki-links';
import { withBase } from '$lib/base-path';

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

/** Not found — or moved, then where to, if the assistant may know. */
async function notFoundOrMoved(path: string, access: PageAccess) {
	const movedTo = await movedPath(path);
	if (movedTo && access.canRead(movedTo)) {
		return failure(`Die Seite "${path}" wurde nach "${movedTo}" verschoben. Nutze diesen Pfad.`);
	}
	return notFound(path);
}

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

const TAGS = z
	.array(z.string())
	.max(20)
	.optional()
	.describe(
		'Tags der Seite, z. B. ["hr", "prozess"]; ersetzen die bisherigen. Vorhandene Tags ' +
			'(`list_tags`) wiederverwenden. Weglassen lässt die Tags, wie sie sind.'
	);

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
				'Seiten haben Tags (`list_tags`, `list_pages` mit `tag`). Was noch keinen Platz ' +
				'hat, kommt in die persönliche Inbox (`add_to_inbox`). ' +
				'Jede Änderung wird als neue Version gespeichert und lässt sich wiederherstellen.'
		}
	);
	const pageUrl = (path: string) => `${origin}${withBase(`/w/${path}`)}`;

	server.registerTool(
		'search',
		{
			title: 'Wiki durchsuchen',
			description: semanticSearchEnabled
				? 'Durchsucht Titel, Pfade und Text aller Wiki-Seiten: nach den Suchwörtern und nach ' +
					'der Bedeutung (semantische Suche) – auch Fragen und Umschreibungen finden passende ' +
					'Seiten. Gibt die passendsten Seiten zurück, mit dem passendsten Textausschnitt. ' +
					'Die `id` eines Treffers ist für `fetch`.'
				: 'Volltextsuche über Titel, Pfade und Text aller Wiki-Seiten. Alle Suchwörter müssen ' +
					'vorkommen; Wortformen werden mitgefunden. Gibt die passendsten Seiten zurück, ' +
					'mit Textausschnitt. Die `id` eines Treffers ist für `fetch`.',
			inputSchema: {
				query: z
					.string()
					.min(1)
					.describe(semanticSearchEnabled ? 'Suchwörter oder eine Frage' : 'Suchwörter')
			},
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
				'Liest eine Wiki-Seite vollständig als Markdown, mit ihren Tags und den Pfaden der ' +
				'Seiten, auf die sie verlinkt.',
			inputSchema: { id: z.string().min(1).describe('Pfad der Seite, z. B. personal/kuendigung') },
			annotations: READ_ONLY
		},
		async ({ id }) => {
			const found = actor.access.canRead(id) ? await getPageWithLatestVersion(id) : null;
			if (!found) return notFoundOrMoved(id, actor.access);
			const [allPages, tags] = await Promise.all([listPages(), tagsOf(found.page.id)]);
			const pages = actor.access.readable(allPages);
			const bindings = await linkBindings(found.page.id, pages);
			return json({
				id: found.page.path,
				title: found.version.title,
				// Links to renamed or moved pages already read as those pages are called now.
				text: refreshWikiLinks(found.version.content, pages, bindings),
				url: pageUrl(found.page.path),
				metadata: {
					version: found.version.versionNumber,
					updatedAt: found.page.updatedAt.toISOString(),
					tags,
					linksTo: linkedPagePaths(found.version.content, pages, bindings)
				}
			});
		}
	);

	server.registerTool(
		'list_pages',
		{
			title: 'Seiten auflisten',
			description:
				'Listet die Seiten des Wikis (Pfad, Titel, Tags, letzte Änderung), nach Pfad ' +
				'sortiert. Mit `prefix` nur einen Bereich, z. B. "projekte" für projekte/…, mit ' +
				'`tag` nur Seiten mit diesem Tag.',
			inputSchema: {
				prefix: z.string().optional().describe('Nur Seiten unter diesem Pfad'),
				tag: z.string().optional().describe('Nur Seiten mit diesem Tag')
			},
			annotations: READ_ONLY
		},
		async ({ prefix, tag }) => {
			const base = prefix?.replace(/^\/+|\/+$/g, '');
			const [allPages, pageTags] = await Promise.all([listPages(), listPageTags()]);
			const tagsByPage = new Map<string, string[]>();
			for (const row of pageTags) {
				tagsByPage.set(row.pageId, [...(tagsByPage.get(row.pageId) ?? []), row.tag]);
			}
			const wanted = tag === undefined ? undefined : parseTags([tag])[0];
			const pages = actor.access
				.readable(allPages)
				.filter((p) => !base || p.path === base || p.path.startsWith(`${base}/`))
				.filter((p) => wanted === undefined || tagsByPage.get(p.id)?.includes(wanted));
			return json({
				pages: pages.map((p) => ({
					id: p.path,
					title: p.title,
					tags: tagsByPage.get(p.id) ?? [],
					updatedAt: p.updatedAt.toISOString()
				}))
			});
		}
	);

	server.registerTool(
		'list_tags',
		{
			title: 'Tags auflisten',
			description:
				'Alle Tags im Wiki mit der Zahl ihrer Seiten – zum Wiederverwenden beim Anlegen ' +
				'und Ändern, und um mit `list_pages` die Seiten eines Tags zu finden.',
			annotations: READ_ONLY
		},
		async () => {
			const tags = await readableTags(actor.access);
			return json({ tags: [...tags].map(([tag, pages]) => ({ tag, pages: pages.length })) });
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
				tags: TAGS,
				change_summary: CHANGE_SUMMARY
			},
			annotations: WRITES
		},
		async ({ id, content, tags, change_summary }) => {
			const path = slugifyPath(id);
			if (!path) return failure(`"${id}" ist kein gültiger Pfad.`);
			if (!actor.access.canEdit(path)) return notAllowed(path);
			const title = titleFromMarkdown(content).slice(0, 200);
			if (!title) return failure('Beginne den Text mit einer Überschrift (`# Titel`).');

			try {
				const pageId = await createPage({
					path,
					title,
					content,
					authorId: actor.userId,
					via: actor.via,
					changeSummary: change_summary
				});
				if (tags) await setTags(pageId, parseTags(tags));
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
				tags: TAGS,
				change_summary: CHANGE_SUMMARY
			},
			annotations: WRITES
		},
		async ({ id, content, base_version, tags, change_summary }) => {
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
				if (tags) await setTags(found.page.id, parseTags(tags));
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

	server.registerTool(
		'move_page',
		{
			title: 'Seite verschieben',
			description:
				'Verschiebt eine Seite samt Unterseiten an einen neuen Pfad – in einen anderen ' +
				'Bereich oder unter einen anderen Namen in der Adresse. Links auf die Seite bleiben ' +
				'gültig, alte Adressen leiten weiter. Am neuen Ort gelten dessen Leserechte; ' +
				'`readers` sagt, wer dadurch neu lesen darf oder nicht mehr.',
			inputSchema: {
				id: z.string().min(1).describe('Jetziger Pfad der Seite'),
				new_id: z.string().min(1).describe('Neuer Pfad, z. B. projekte/archiv/relaunch')
			},
			annotations: WRITES
		},
		async ({ id, new_id }) => {
			const result = await movePage(id, new_id, actor, authMode);
			if (!result.ok) return failure(result.message);
			const { plan } = result;
			return json({
				id: plan.to,
				url: pageUrl(plan.to),
				pagesMoved: plan.moves.length,
				readers: plan.readers
			});
		}
	);

	server.registerTool(
		'add_to_inbox',
		{
			title: 'In der Inbox notieren',
			description:
				'Notiert etwas schnell in der persönlichen Inbox des Nutzers, die nur er sieht – ' +
				'für Gedanken, Aufgaben und Funde, deren Platz im Wiki noch offen ist. Ist klar, ' +
				'wohin es gehört, besser gleich `append_to_page` oder `create_page`.',
			inputSchema: {
				content: z.string().min(1).max(MAX_NOTE_LENGTH).describe('Die Notiz, als Markdown')
			},
			annotations: WRITES
		},
		async ({ content }) => {
			const id = await addNote({ userId: actor.userId, content: content.trim(), via: actor.via });
			return json({ id });
		}
	);

	server.registerTool(
		'list_inbox',
		{
			title: 'Inbox lesen',
			description:
				'Die Notizen in der Inbox des Nutzers, neueste zuerst – etwa um sie gemeinsam ' +
				'einzusortieren (`file_inbox_note`).',
			annotations: READ_ONLY
		},
		async () => {
			const notes = await listNotes(actor.userId);
			return json({
				notes: notes.map((note) => ({
					id: note.id,
					text: note.content,
					createdAt: note.createdAt.toISOString(),
					via: note.via
				}))
			});
		}
	);

	server.registerTool(
		'file_inbox_note',
		{
			title: 'Notiz einsortieren',
			description:
				'Sortiert eine Inbox-Notiz ins Wiki ein: Gibt es unter `page_id` eine Seite, wird ' +
				'die Notiz angehängt, sonst entsteht dort eine neue Seite. Danach ist die Notiz ' +
				'aus der Inbox verschwunden.',
			inputSchema: {
				id: z.string().min(1).describe('Id der Notiz aus `list_inbox`'),
				page_id: z.string().min(1).describe('Pfad der Seite, z. B. projekte/ideen')
			},
			annotations: WRITES
		},
		async ({ id, page_id }) => {
			const result = await fileNote(actor, id, page_id);
			if (!result.ok) return failure(result.message);
			return json({ id: result.path, created: result.created, url: pageUrl(result.path) });
		}
	);

	server.registerTool(
		'delete_inbox_note',
		{
			title: 'Notiz löschen',
			description: 'Löscht eine Notiz aus der Inbox, z. B. wenn sie erledigt ist.',
			inputSchema: { id: z.string().min(1).describe('Id der Notiz aus `list_inbox`') },
			annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false }
		},
		async ({ id }) => {
			if (!(await deleteNote(actor.userId, id))) return failure('Diese Notiz gibt es nicht.');
			return json({ deleted: id });
		}
	);

	return server;
}

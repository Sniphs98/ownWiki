import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { db } from '$lib/server/db';
import type * as schema from '$lib/server/db/schema/sqlite';
import { germanPrefix, markdownToSearchText, queryTerms, toSnippet } from './text';
import { MATCH_END, MATCH_START, type SearchHit, type SearchProvider } from './types';

/**
 * Full-text search with SQLite's FTS5. The index is a virtual table that
 * Drizzle can't describe, so it's created here on first use rather than
 * in a migration (that also covers databases set up with `db:push`), and
 * drizzle.config.ts keeps Drizzle from touching it.
 */
const client = (db as BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database })
	.$client;

let ready = false;

function ensureIndex() {
	if (ready) return;
	client.exec(`
		CREATE VIRTUAL TABLE IF NOT EXISTS page_search USING fts5(
			page_id UNINDEXED, path, title, content,
			tokenize = 'unicode61 remove_diacritics 2'
		)
	`);
	// Pages saved before the index existed (or written around the app):
	// rebuild when the index doesn't cover exactly the current pages.
	const { pages } = client.prepare('SELECT count(*) AS pages FROM page').get() as { pages: number };
	const { indexed } = client
		.prepare('SELECT count(*) AS indexed FROM page_search WHERE page_id IN (SELECT id FROM page)')
		.get() as { indexed: number };
	const { total } = client.prepare('SELECT count(*) AS total FROM page_search').get() as {
		total: number;
	};
	if (indexed !== pages || total !== pages) rebuild();
	ready = true;
}

const LATEST_VERSIONS = `
	SELECT p.id, p.path, v.title, v.content
	FROM page p
	JOIN page_version v ON v.page_id = p.id
	WHERE v.version_number = (SELECT max(version_number) FROM page_version WHERE page_id = p.id)
`;

type LatestVersion = { id: string; path: string; title: string; content: string };

function rebuild() {
	const rows = client.prepare(LATEST_VERSIONS).all() as LatestVersion[];
	const insert = client.prepare(
		'INSERT INTO page_search (page_id, path, title, content) VALUES (?, ?, ?, ?)'
	);
	client.transaction(() => {
		client.exec('DELETE FROM page_search');
		for (const row of rows) {
			insert.run(row.id, row.path, row.title, markdownToSearchText(row.content));
		}
	})();
}

export const sqliteSearch: SearchProvider = {
	async search(query, limit) {
		ensureIndex();
		const terms = queryTerms(query);
		if (terms.length === 0) return [];
		// Every word must occur (implicit AND), each as a prefix.
		const match = terms.map((term) => `"${germanPrefix(term)}"*`).join(' ');

		const rows = client
			.prepare(
				`SELECT page_id AS pageId, path, title,
					snippet(page_search, 3, ?, ?, '…', 24) AS snippet
				FROM page_search
				WHERE page_search MATCH ?
				-- Weights per column: page_id, path, title, content.
				ORDER BY bm25(page_search, 0, 2, 10, 1)
				LIMIT ?`
			)
			.all(MATCH_START, MATCH_END, match, limit) as (Omit<SearchHit, 'snippet'> & {
			snippet: string;
		})[];
		return rows.map((row) => ({ ...row, snippet: toSnippet(row.snippet) }));
	},

	async indexPage(pageId) {
		ensureIndex();
		const row = client.prepare(`${LATEST_VERSIONS} AND p.id = ?`).get(pageId) as
			LatestVersion | undefined;
		client.transaction(() => {
			client.prepare('DELETE FROM page_search WHERE page_id = ?').run(pageId);
			if (row) {
				client
					.prepare('INSERT INTO page_search (page_id, path, title, content) VALUES (?, ?, ?, ?)')
					.run(row.id, row.path, row.title, markdownToSearchText(row.content));
			}
		})();
	},

	async removePage(pageId) {
		ensureIndex();
		client.prepare('DELETE FROM page_search WHERE page_id = ?').run(pageId);
	}
};

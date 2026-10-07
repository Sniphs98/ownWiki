import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import { db } from '$lib/server/db';
import type * as schema from '$lib/server/db/schema/pg';
import { markdownToSearchText, queryTerms, toSnippet } from './text';
import { MATCH_END, MATCH_START, type SearchProvider } from './types';

/**
 * Full-text search with PostgreSQL's German text search configuration
 * (real stemming: "Kündigungen" finds "Kündigung"). Like the SQLite
 * version, the table is created here on first use rather than in a
 * migration, and drizzle.config.ts keeps Drizzle from touching it.
 */
const sql = (db as PostgresJsDatabase<typeof schema> & { $client: Sql }).$client;

let ready: Promise<void> | null = null;

function ensureIndex() {
	ready ??= (async () => {
		await sql`
			CREATE TABLE IF NOT EXISTS page_search (
				page_id text PRIMARY KEY REFERENCES page(id) ON DELETE CASCADE,
				path text NOT NULL,
				title text NOT NULL,
				content text NOT NULL,
				document tsvector GENERATED ALWAYS AS (
					setweight(to_tsvector('german', title), 'A') ||
					setweight(to_tsvector('german', replace(path, '/', ' ')), 'B') ||
					setweight(to_tsvector('german', content), 'C')
				) STORED
			)`;
		await sql`CREATE INDEX IF NOT EXISTS page_search_document_idx ON page_search USING gin (document)`;

		const [{ pages, indexed }] = await sql<{ pages: number; indexed: number }[]>`
			SELECT (SELECT count(*) FROM page)::int AS pages,
				(SELECT count(*) FROM page_search)::int AS indexed`;
		if (pages !== indexed) await rebuild();
	})().catch((error) => {
		ready = null; // try again on the next call
		throw error;
	});
	return ready;
}

type LatestVersion = { id: string; path: string; title: string; content: string };

function latestVersions(pageId?: string) {
	return sql<LatestVersion[]>`
		SELECT DISTINCT ON (p.id) p.id, p.path, v.title, v.content
		FROM page p
		JOIN page_version v ON v.page_id = p.id
		${pageId ? sql`WHERE p.id = ${pageId}` : sql``}
		ORDER BY p.id, v.version_number DESC`;
}

async function rebuild() {
	const rows = await latestVersions();
	await sql.begin(async (tx) => {
		await tx`DELETE FROM page_search`;
		for (const row of rows) {
			await tx`
				INSERT INTO page_search (page_id, path, title, content)
				VALUES (${row.id}, ${row.path}, ${row.title}, ${markdownToSearchText(row.content)})`;
		}
	});
}

export const pgSearch: SearchProvider = {
	async search(query, limit) {
		await ensureIndex();
		const terms = queryTerms(query);
		if (terms.length === 0) return [];
		// Every word must occur, each also as a prefix of a longer word.
		const tsquery = terms.map((term) => `${term}:*`).join(' & ');
		const options = `StartSel=${MATCH_START}, StopSel=${MATCH_END}, MaxWords=30, MinWords=12, MaxFragments=1`;

		const rows = await sql<{ pageId: string; path: string; title: string; snippet: string }[]>`
			SELECT page_id AS "pageId", path, title,
				ts_headline('german', content, q, ${options}) AS snippet
			FROM page_search, to_tsquery('german', ${tsquery}) AS q
			WHERE document @@ q
			ORDER BY ts_rank(document, q) DESC
			LIMIT ${limit}`;
		return rows.map((row) => ({ ...row, snippet: toSnippet(row.snippet) }));
	},

	async indexPage(pageId) {
		await ensureIndex();
		const [row] = await latestVersions(pageId);
		if (!row) {
			await sql`DELETE FROM page_search WHERE page_id = ${pageId}`;
			return;
		}
		const content = markdownToSearchText(row.content);
		await sql`
			INSERT INTO page_search (page_id, path, title, content)
			VALUES (${row.id}, ${row.path}, ${row.title}, ${content})
			ON CONFLICT (page_id) DO UPDATE
				SET path = excluded.path, title = excluded.title, content = excluded.content`;
	},

	async removePage(pageId) {
		await ensureIndex();
		// Also removed by the foreign key's ON DELETE CASCADE.
		await sql`DELETE FROM page_search WHERE page_id = ${pageId}`;
	}
};

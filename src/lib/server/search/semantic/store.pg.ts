import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';
import { db } from '$lib/server/db';
import type * as schema from '$lib/server/db/schema/pg';
import { latestVersions } from '../search.pg';
import { fromBytes, toBytes } from './vectors';
import type { ChunkStore, PageChunks } from './store.types';

const sql = (db as PostgresJsDatabase<typeof schema> & { $client: Sql }).$client;

let ready: Promise<void> | null = null;

function ensureTable() {
	ready ??= (async () => {
		await sql`
			CREATE TABLE IF NOT EXISTS page_search_chunk (
				page_id text NOT NULL REFERENCES page(id) ON DELETE CASCADE,
				position integer NOT NULL,
				text text NOT NULL,
				hash text NOT NULL,
				embedding bytea NOT NULL,
				PRIMARY KEY (page_id, position)
			)`;
	})().catch((error) => {
		ready = null; // try again on the next call
		throw error;
	});
	return ready;
}

type Row = {
	pageId: string;
	path: string;
	title: string;
	text: string;
	hash: string;
	embedding: Buffer;
};

export const pgChunkStore: ChunkStore = {
	async loadAll() {
		await ensureTable();
		const rows = await sql<Row[]>`
			SELECT c.page_id AS "pageId", p.path, p.title, c.text, c.hash, c.embedding
			FROM page_search_chunk c JOIN page p ON p.id = c.page_id
			ORDER BY c.page_id, c.position`;
		const pages = new Map<string, PageChunks>();
		for (const { pageId, path, title, text, hash, embedding } of rows) {
			let page = pages.get(pageId);
			if (!page) pages.set(pageId, (page = { pageId, path, title, chunks: [] }));
			page.chunks.push({ text, hash, embedding: fromBytes(embedding) });
		}
		return [...pages.values()];
	},

	async pageIds() {
		return (await sql<{ id: string }[]>`SELECT id FROM page`).map((row) => row.id);
	},

	async latest(pageId) {
		const [row] = await latestVersions(pageId);
		return row;
	},

	async replacePage(pageId, chunks) {
		await ensureTable();
		await sql.begin(async (tx) => {
			await tx`DELETE FROM page_search_chunk WHERE page_id = ${pageId}`;
			for (const [position, chunk] of chunks.entries()) {
				await tx`
					INSERT INTO page_search_chunk (page_id, position, text, hash, embedding)
					VALUES (${pageId}, ${position}, ${chunk.text}, ${chunk.hash}, ${toBytes(chunk.embedding)})`;
			}
		});
	},

	async removePage(pageId) {
		await ensureTable();
		await sql`DELETE FROM page_search_chunk WHERE page_id = ${pageId}`;
	}
};

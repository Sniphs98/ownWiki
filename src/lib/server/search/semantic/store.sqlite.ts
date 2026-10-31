import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { db } from '$lib/server/db';
import type * as schema from '$lib/server/db/schema/sqlite';
import { LATEST_VERSIONS, type LatestVersion } from '../search.sqlite';
import { fromBytes, toBytes } from './vectors';
import type { ChunkStore, PageChunks } from './store.types';

const client = (db as BetterSQLite3Database<typeof schema> & { $client: BetterSqlite3.Database })
	.$client;

let ready = false;

function ensureTable() {
	if (ready) return;
	client.exec(`
		CREATE TABLE IF NOT EXISTS page_search_chunk (
			page_id text NOT NULL REFERENCES page(id) ON DELETE CASCADE,
			position integer NOT NULL,
			text text NOT NULL,
			hash text NOT NULL,
			embedding blob NOT NULL,
			PRIMARY KEY (page_id, position)
		)
	`);
	ready = true;
}

type Row = {
	pageId: string;
	path: string;
	title: string;
	text: string;
	hash: string;
	embedding: Buffer;
};

export const sqliteChunkStore: ChunkStore = {
	async loadAll() {
		ensureTable();
		const rows = client
			.prepare(
				`SELECT c.page_id AS pageId, p.path, p.title, c.text, c.hash, c.embedding
				FROM page_search_chunk c JOIN page p ON p.id = c.page_id
				ORDER BY c.page_id, c.position`
			)
			.all() as Row[];
		const pages = new Map<string, PageChunks>();
		for (const { pageId, path, title, text, hash, embedding } of rows) {
			let page = pages.get(pageId);
			if (!page) pages.set(pageId, (page = { pageId, path, title, chunks: [] }));
			page.chunks.push({ text, hash, embedding: fromBytes(embedding) });
		}
		return [...pages.values()];
	},

	async pageIds() {
		return (client.prepare('SELECT id FROM page').all() as { id: string }[]).map((row) => row.id);
	},

	async latest(pageId) {
		return client.prepare(`${LATEST_VERSIONS} AND p.id = ?`).get(pageId) as
			LatestVersion | undefined;
	},

	async replacePage(pageId, chunks) {
		ensureTable();
		const insert = client.prepare(
			'INSERT INTO page_search_chunk (page_id, position, text, hash, embedding) VALUES (?, ?, ?, ?, ?)'
		);
		client.transaction(() => {
			client.prepare('DELETE FROM page_search_chunk WHERE page_id = ?').run(pageId);
			chunks.forEach((chunk, position) => {
				insert.run(pageId, position, chunk.text, chunk.hash, toBytes(chunk.embedding));
			});
		})();
	},

	async removePage(pageId) {
		ensureTable();
		client.prepare('DELETE FROM page_search_chunk WHERE page_id = ?').run(pageId);
	}
};

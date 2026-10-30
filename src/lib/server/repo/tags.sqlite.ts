import { asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '$lib/server/db';
import { pageTag } from '$lib/server/db/schema/sqlite';
import type * as schema from '$lib/server/db/schema/sqlite';

const sqlite = db as BetterSQLite3Database<typeof schema>;

export async function tagsOf(pageId: string): Promise<string[]> {
	const rows = await sqlite
		.select({ tag: pageTag.tag })
		.from(pageTag)
		.where(eq(pageTag.pageId, pageId))
		.orderBy(asc(pageTag.tag));
	return rows.map((row) => row.tag);
}

/** Every tag of every page; callers keep the pages the visitor may read. */
export async function listPageTags(): Promise<{ pageId: string; tag: string }[]> {
	return sqlite
		.select({ pageId: pageTag.pageId, tag: pageTag.tag })
		.from(pageTag)
		.orderBy(asc(pageTag.tag));
}

/** Replaces a page's tags (already normalized, see $lib/tags.ts). */
export async function setTags(pageId: string, tags: string[]): Promise<void> {
	// better-sqlite3 transactions are synchronous, hence .run().
	sqlite.transaction((tx) => {
		tx.delete(pageTag).where(eq(pageTag.pageId, pageId)).run();
		if (tags.length > 0) {
			tx.insert(pageTag)
				.values(tags.map((tag) => ({ pageId, tag })))
				.run();
		}
	});
}

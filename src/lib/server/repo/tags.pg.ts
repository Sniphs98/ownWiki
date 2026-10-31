import { asc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '$lib/server/db';
import { pageTag } from '$lib/server/db/schema/pg';
import type * as schema from '$lib/server/db/schema/pg';

const pg = db as PostgresJsDatabase<typeof schema>;

export async function tagsOf(pageId: string): Promise<string[]> {
	const rows = await pg
		.select({ tag: pageTag.tag })
		.from(pageTag)
		.where(eq(pageTag.pageId, pageId))
		.orderBy(asc(pageTag.tag));
	return rows.map((row) => row.tag);
}

/** Every tag of every page; callers keep the pages the visitor may read. */
export async function listPageTags(): Promise<{ pageId: string; tag: string }[]> {
	return pg
		.select({ pageId: pageTag.pageId, tag: pageTag.tag })
		.from(pageTag)
		.orderBy(asc(pageTag.tag));
}

/** Replaces a page's tags (already normalized, see $lib/tags.ts). */
export async function setTags(pageId: string, tags: string[]): Promise<void> {
	await pg.transaction(async (tx) => {
		await tx.delete(pageTag).where(eq(pageTag.pageId, pageId));
		if (tags.length > 0) {
			await tx.insert(pageTag).values(tags.map((tag) => ({ pageId, tag })));
		}
	});
}

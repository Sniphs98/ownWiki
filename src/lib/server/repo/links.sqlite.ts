import { eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '$lib/server/db';
import { pageLink } from '$lib/server/db/schema/sqlite';
import type * as schema from '$lib/server/db/schema/sqlite';

const sqlite = db as BetterSQLite3Database<typeof schema>;

/** Replaces what a page links to. */
export async function setLinks(pageId: string, targets: string[]): Promise<void> {
	// better-sqlite3 transactions are synchronous, hence .run().
	sqlite.transaction((tx) => {
		tx.delete(pageLink).where(eq(pageLink.pageId, pageId)).run();
		if (targets.length > 0) {
			tx.insert(pageLink)
				.values(targets.map((target) => ({ pageId, target })))
				.run();
		}
	});
}

/** The pages linking to any of these targets, with the target they use. */
export async function linksTo(targets: string[]): Promise<{ pageId: string; target: string }[]> {
	if (targets.length === 0) return [];
	return sqlite
		.select({ pageId: pageLink.pageId, target: pageLink.target })
		.from(pageLink)
		.where(inArray(pageLink.target, targets));
}

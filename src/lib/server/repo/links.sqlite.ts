import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '$lib/server/db';
import { pageLink } from '$lib/server/db/schema/sqlite';
import type * as schema from '$lib/server/db/schema/sqlite';
import type { BoundLink, StoredLink } from './links.types';

const sqlite = db as BetterSQLite3Database<typeof schema>;

/** Replaces what a page links to, with the page each link is bound to. */
export async function setLinks(pageId: string, links: BoundLink[]): Promise<void> {
	// better-sqlite3 transactions are synchronous, hence .run().
	sqlite.transaction((tx) => {
		tx.delete(pageLink).where(eq(pageLink.pageId, pageId)).run();
		if (links.length > 0) {
			tx.insert(pageLink)
				.values(links.map((link) => ({ pageId, target: link.target, targetPageId: link.pageId })))
				.run();
		}
	});
}

/** A page's links, with what they're bound to. */
export async function linksOf(pageId: string): Promise<BoundLink[]> {
	return sqlite
		.select({ target: pageLink.target, pageId: pageLink.targetPageId })
		.from(pageLink)
		.where(eq(pageLink.pageId, pageId));
}

/** The links that may lead to a page: bound to it, or not bound yet and written one of these ways. */
export async function linksTo(pageId: string, targets: string[]): Promise<StoredLink[]> {
	return sqlite
		.select({
			fromPageId: pageLink.pageId,
			target: pageLink.target,
			pageId: pageLink.targetPageId
		})
		.from(pageLink)
		.where(
			or(
				eq(pageLink.targetPageId, pageId),
				and(isNull(pageLink.targetPageId), inArray(pageLink.target, targets))
			)
		);
}

/** Binds the links not bound yet that are written one of these ways to a page that now has that name. */
export async function bindUnbound(targets: string[], pageId: string): Promise<void> {
	await sqlite
		.update(pageLink)
		.set({ targetPageId: pageId })
		.where(and(isNull(pageLink.targetPageId), inArray(pageLink.target, targets)));
}

import { eq, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '$lib/server/db';
import { pageLink } from '$lib/server/db/schema/pg';
import type * as schema from '$lib/server/db/schema/pg';

const pg = db as PostgresJsDatabase<typeof schema>;

/** Replaces what a page links to. */
export async function setLinks(pageId: string, targets: string[]): Promise<void> {
	await pg.transaction(async (tx) => {
		await tx.delete(pageLink).where(eq(pageLink.pageId, pageId));
		if (targets.length > 0) {
			await tx.insert(pageLink).values(targets.map((target) => ({ pageId, target })));
		}
	});
}

/** The pages linking to any of these targets, with the target they use. */
export async function linksTo(targets: string[]): Promise<{ pageId: string; target: string }[]> {
	if (targets.length === 0) return [];
	return pg
		.select({ pageId: pageLink.pageId, target: pageLink.target })
		.from(pageLink)
		.where(inArray(pageLink.target, targets));
}

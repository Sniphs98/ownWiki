import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '$lib/server/db';
import { pagePin } from '$lib/server/db/schema/pg';
import type * as schema from '$lib/server/db/schema/pg';

const pg = db as PostgresJsDatabase<typeof schema>;

export async function pinnedPaths(userId: string): Promise<string[]> {
	const rows = await pg
		.select({ path: pagePin.path })
		.from(pagePin)
		.where(eq(pagePin.userId, userId));
	return rows.map((row) => row.path);
}

export async function pin(userId: string, path: string): Promise<void> {
	await pg.insert(pagePin).values({ userId, path }).onConflictDoNothing();
}

export async function unpin(userId: string, path: string): Promise<void> {
	await pg.delete(pagePin).where(and(eq(pagePin.userId, userId), eq(pagePin.path, path)));
}

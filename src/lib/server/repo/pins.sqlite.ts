import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '$lib/server/db';
import { pagePin } from '$lib/server/db/schema/sqlite';
import type * as schema from '$lib/server/db/schema/sqlite';

const sqlite = db as BetterSQLite3Database<typeof schema>;

export async function pinnedPaths(userId: string): Promise<string[]> {
	const rows = await sqlite
		.select({ path: pagePin.path })
		.from(pagePin)
		.where(eq(pagePin.userId, userId));
	return rows.map((row) => row.path);
}

export async function pin(userId: string, path: string): Promise<void> {
	await sqlite.insert(pagePin).values({ userId, path }).onConflictDoNothing();
}

export async function unpin(userId: string, path: string): Promise<void> {
	await sqlite.delete(pagePin).where(and(eq(pagePin.userId, userId), eq(pagePin.path, path)));
}

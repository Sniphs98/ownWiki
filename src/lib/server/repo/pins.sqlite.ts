import { and, eq, like, or } from 'drizzle-orm';
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

/** Pins on a moved page or folder, and below it, follow it to its new path. */
export async function movePins(from: string, to: string): Promise<void> {
	const pins = await sqlite
		.select()
		.from(pagePin)
		.where(or(eq(pagePin.path, from), like(pagePin.path, `${from}/%`)));
	// LIKE treats "_" as a wildcard: keep exactly the path and what's below it.
	const moved = pins.filter((pin) => pin.path === from || pin.path.startsWith(`${from}/`));
	for (const pin of moved) {
		await sqlite
			.delete(pagePin)
			.where(and(eq(pagePin.userId, pin.userId), eq(pagePin.path, pin.path)));
		await sqlite
			.insert(pagePin)
			.values({ userId: pin.userId, path: to + pin.path.slice(from.length) })
			.onConflictDoNothing();
	}
}

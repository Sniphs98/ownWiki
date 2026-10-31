import { and, eq, like, or } from 'drizzle-orm';
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

/** Pins on a moved page or folder, and below it, follow it to its new path. */
export async function movePins(from: string, to: string): Promise<void> {
	const pins = await pg
		.select()
		.from(pagePin)
		.where(or(eq(pagePin.path, from), like(pagePin.path, `${from}/%`)));
	// LIKE treats "_" as a wildcard: keep exactly the path and what's below it.
	const moved = pins.filter((pin) => pin.path === from || pin.path.startsWith(`${from}/`));
	for (const pin of moved) {
		await pg.delete(pagePin).where(and(eq(pagePin.userId, pin.userId), eq(pagePin.path, pin.path)));
		await pg
			.insert(pagePin)
			.values({ userId: pin.userId, path: to + pin.path.slice(from.length) })
			.onConflictDoNothing();
	}
}

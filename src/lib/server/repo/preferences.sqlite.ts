import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '$lib/server/db';
import { userPreference } from '$lib/server/db/schema/sqlite';
import type * as schema from '$lib/server/db/schema/sqlite';
import { normalizeToolbar } from '$lib/toolbar';
import type { UserPreferences } from './preferences.types';

const sqlite = db as BetterSQLite3Database<typeof schema>;

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
	const row = await sqlite.query.userPreference.findFirst({
		where: eq(userPreference.userId, userId)
	});
	return { toolbar: row?.toolbar ? normalizeToolbar(JSON.parse(row.toolbar)) : null };
}

export async function setToolbar(userId: string, toolbar: unknown[] | null): Promise<void> {
	const value = toolbar ? JSON.stringify(normalizeToolbar(toolbar)) : null;
	await sqlite
		.insert(userPreference)
		.values({ userId, toolbar: value, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: userPreference.userId,
			set: { toolbar: value, updatedAt: new Date() }
		});
}

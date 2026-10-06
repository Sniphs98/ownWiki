import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '$lib/server/db';
import { userPreference } from '$lib/server/db/schema/pg';
import type * as schema from '$lib/server/db/schema/pg';
import { normalizeToolbar } from '$lib/toolbar';
import type { UserPreferences } from './preferences.types';

const pg = db as PostgresJsDatabase<typeof schema>;

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
	const row = await pg.query.userPreference.findFirst({
		where: eq(userPreference.userId, userId)
	});
	return { toolbar: row?.toolbar ? normalizeToolbar(JSON.parse(row.toolbar)) : null };
}

export async function setToolbar(userId: string, toolbar: unknown[] | null): Promise<void> {
	const value = toolbar ? JSON.stringify(normalizeToolbar(toolbar)) : null;
	await pg
		.insert(userPreference)
		.values({ userId, toolbar: value, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: userPreference.userId,
			set: { toolbar: value, updatedAt: new Date() }
		});
}

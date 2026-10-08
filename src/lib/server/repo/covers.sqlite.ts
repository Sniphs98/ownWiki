import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '$lib/server/db';
import { pdfCover } from '$lib/server/db/schema/sqlite';
import type * as schema from '$lib/server/db/schema/sqlite';

const sqlite = db as BetterSQLite3Database<typeof schema>;

export async function getCover(pageId: string): Promise<string | null> {
	const row = await sqlite.query.pdfCover.findFirst({ where: eq(pdfCover.pageId, pageId) });
	return row?.content ?? null;
}

export async function setCover(pageId: string, content: string | null): Promise<void> {
	if (content === null) {
		await sqlite.delete(pdfCover).where(eq(pdfCover.pageId, pageId));
		return;
	}
	await sqlite
		.insert(pdfCover)
		.values({ pageId, content, updatedAt: new Date() })
		.onConflictDoUpdate({ target: pdfCover.pageId, set: { content, updatedAt: new Date() } });
}

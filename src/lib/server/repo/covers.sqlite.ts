import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '$lib/server/db';
import { pdfCover } from '$lib/server/db/schema/sqlite';
import type * as schema from '$lib/server/db/schema/sqlite';
import { coverAlignX, coverAlignY, type Cover } from '$lib/cover';

const sqlite = db as BetterSQLite3Database<typeof schema>;

export async function getCover(pageId: string): Promise<Cover | null> {
	const row = await sqlite.query.pdfCover.findFirst({ where: eq(pdfCover.pageId, pageId) });
	if (!row) return null;
	return { content: row.content, alignX: coverAlignX(row.alignX), alignY: coverAlignY(row.alignY) };
}

export async function setCover(pageId: string, cover: Cover | null): Promise<void> {
	if (cover === null) {
		await sqlite.delete(pdfCover).where(eq(pdfCover.pageId, pageId));
		return;
	}
	const values = { ...cover, updatedAt: new Date() };
	await sqlite
		.insert(pdfCover)
		.values({ pageId, ...values })
		.onConflictDoUpdate({ target: pdfCover.pageId, set: values });
}

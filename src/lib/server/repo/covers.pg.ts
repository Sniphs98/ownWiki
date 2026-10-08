import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '$lib/server/db';
import { pdfCover } from '$lib/server/db/schema/pg';
import type * as schema from '$lib/server/db/schema/pg';
import { coverAlignX, coverAlignY, type Cover } from '$lib/cover';

const pg = db as PostgresJsDatabase<typeof schema>;

export async function getCover(pageId: string): Promise<Cover | null> {
	const row = await pg.query.pdfCover.findFirst({ where: eq(pdfCover.pageId, pageId) });
	if (!row) return null;
	return { content: row.content, alignX: coverAlignX(row.alignX), alignY: coverAlignY(row.alignY) };
}

export async function setCover(pageId: string, cover: Cover | null): Promise<void> {
	if (cover === null) {
		await pg.delete(pdfCover).where(eq(pdfCover.pageId, pageId));
		return;
	}
	const values = { ...cover, updatedAt: new Date() };
	await pg
		.insert(pdfCover)
		.values({ pageId, ...values })
		.onConflictDoUpdate({ target: pdfCover.pageId, set: values });
}

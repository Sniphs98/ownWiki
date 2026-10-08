import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '$lib/server/db';
import { pdfCover } from '$lib/server/db/schema/pg';
import type * as schema from '$lib/server/db/schema/pg';

const pg = db as PostgresJsDatabase<typeof schema>;

export async function getCover(pageId: string): Promise<string | null> {
	const row = await pg.query.pdfCover.findFirst({ where: eq(pdfCover.pageId, pageId) });
	return row?.content ?? null;
}

export async function setCover(pageId: string, content: string | null): Promise<void> {
	if (content === null) {
		await pg.delete(pdfCover).where(eq(pdfCover.pageId, pageId));
		return;
	}
	await pg
		.insert(pdfCover)
		.values({ pageId, content, updatedAt: new Date() })
		.onConflictDoUpdate({ target: pdfCover.pageId, set: { content, updatedAt: new Date() } });
}

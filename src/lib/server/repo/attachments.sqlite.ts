import { desc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '$lib/server/db';
import { attachment } from '$lib/server/db/schema/sqlite';
import type * as schema from '$lib/server/db/schema/sqlite';
import type { AttachmentFile, AttachmentMeta, CreateAttachmentInput } from './attachments.types';

const sqlite = db as BetterSQLite3Database<typeof schema>;

export async function listAttachmentsForPage(pageId: string): Promise<AttachmentMeta[]> {
	return sqlite
		.select({
			id: attachment.id,
			filename: attachment.filename,
			mimeType: attachment.mimeType,
			size: attachment.size,
			createdAt: attachment.createdAt
		})
		.from(attachment)
		.where(eq(attachment.pageId, pageId))
		.orderBy(desc(attachment.createdAt));
}

export async function getAttachment(id: string): Promise<AttachmentFile | null> {
	const found = await sqlite.query.attachment.findFirst({ where: eq(attachment.id, id) });
	return found ?? null;
}

export async function createAttachment(input: CreateAttachmentInput): Promise<string> {
	const id = crypto.randomUUID();

	await sqlite.insert(attachment).values({
		id,
		pageId: input.pageId,
		filename: input.filename,
		mimeType: input.mimeType,
		size: input.size,
		data: input.data,
		uploadedBy: input.uploadedBy
	});

	return id;
}

export async function deleteAttachment(id: string): Promise<void> {
	await sqlite.delete(attachment).where(eq(attachment.id, id));
}

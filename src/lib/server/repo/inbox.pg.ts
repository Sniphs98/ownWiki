import { and, count, desc, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { db } from '$lib/server/db';
import { inboxNote } from '$lib/server/db/schema/pg';
import type * as schema from '$lib/server/db/schema/pg';
import type { InboxNote } from './inbox.types';

const pg = db as PostgresJsDatabase<typeof schema>;

const columns = {
	id: inboxNote.id,
	content: inboxNote.content,
	via: inboxNote.via,
	createdAt: inboxNote.createdAt
};

/** A person's notes, newest first. */
export async function listNotes(userId: string): Promise<InboxNote[]> {
	return pg
		.select(columns)
		.from(inboxNote)
		.where(eq(inboxNote.userId, userId))
		.orderBy(desc(inboxNote.createdAt));
}

export async function countNotes(userId: string): Promise<number> {
	const [row] = await pg
		.select({ notes: count() })
		.from(inboxNote)
		.where(eq(inboxNote.userId, userId));
	return row?.notes ?? 0;
}

/** One of a person's notes; null for someone else's. */
export async function getNote(userId: string, id: string): Promise<InboxNote | null> {
	const [row] = await pg
		.select(columns)
		.from(inboxNote)
		.where(and(eq(inboxNote.id, id), eq(inboxNote.userId, userId)));
	return row ?? null;
}

export async function addNote(note: {
	userId: string;
	content: string;
	via?: string;
}): Promise<string> {
	const id = crypto.randomUUID();
	await pg.insert(inboxNote).values({ id, ...note });
	return id;
}

/** Deletes one of a person's notes; false if there was none. */
export async function deleteNote(userId: string, id: string): Promise<boolean> {
	const deleted = await pg
		.delete(inboxNote)
		.where(and(eq(inboxNote.id, id), eq(inboxNote.userId, userId)))
		.returning({ id: inboxNote.id });
	return deleted.length > 0;
}

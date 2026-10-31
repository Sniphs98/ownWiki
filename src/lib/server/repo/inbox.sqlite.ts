import { and, count, desc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { db } from '$lib/server/db';
import { inboxNote } from '$lib/server/db/schema/sqlite';
import type * as schema from '$lib/server/db/schema/sqlite';
import type { InboxNote } from './inbox.types';

const sqlite = db as BetterSQLite3Database<typeof schema>;

const columns = {
	id: inboxNote.id,
	content: inboxNote.content,
	via: inboxNote.via,
	createdAt: inboxNote.createdAt
};

/** A person's notes, newest first. */
export async function listNotes(userId: string): Promise<InboxNote[]> {
	return sqlite
		.select(columns)
		.from(inboxNote)
		.where(eq(inboxNote.userId, userId))
		.orderBy(desc(inboxNote.createdAt));
}

export async function countNotes(userId: string): Promise<number> {
	const [row] = await sqlite
		.select({ notes: count() })
		.from(inboxNote)
		.where(eq(inboxNote.userId, userId));
	return row?.notes ?? 0;
}

/** One of a person's notes; null for someone else's. */
export async function getNote(userId: string, id: string): Promise<InboxNote | null> {
	const [row] = await sqlite
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
	await sqlite.insert(inboxNote).values({ id, ...note });
	return id;
}

/** Deletes one of a person's notes; false if there was none. */
export async function deleteNote(userId: string, id: string): Promise<boolean> {
	const deleted = await sqlite
		.delete(inboxNote)
		.where(and(eq(inboxNote.id, id), eq(inboxNote.userId, userId)))
		.returning({ id: inboxNote.id });
	return deleted.length > 0;
}

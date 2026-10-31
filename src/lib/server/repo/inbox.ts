import { dbDialect } from '$lib/server/db';

const impl =
	dbDialect === 'postgresql' ? await import('./inbox.pg') : await import('./inbox.sqlite');

export const listNotes = impl.listNotes;
export const countNotes = impl.countNotes;
export const getNote = impl.getNote;
export const addNote = impl.addNote;
export const deleteNote = impl.deleteNote;

export type { InboxNote } from './inbox.types';

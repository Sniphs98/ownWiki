import { deleteNote, getNote } from '$lib/server/repo/inbox';
import {
	addPageVersion,
	createPage,
	getPageWithLatestVersion,
	PageConflictError
} from '$lib/server/repo/pages';
import type { PageAccess } from '$lib/server/access';
import { titleFromMarkdown } from '$lib/page-title';
import { slugifyPath } from '$lib/slug';

/** Longest inbox note, in characters. */
export const MAX_NOTE_LENGTH = 20_000;

export type FileResult =
	{ ok: true; path: string; created: boolean } | { ok: false; message: string };

/** "projekte/neue-ideen" → "Neue ideen": a title for a page made from a note. */
function titleFromPath(path: string) {
	const name = (path.split('/').at(-1) ?? path).replace(/[-_]+/g, ' ');
	return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Sorts an inbox note into the wiki: appended to the page at `rawPath`, or
 * a new page there if there is none — as `author`, through `via` if an
 * assistant does it. The note is gone from the inbox afterwards.
 */
export async function fileNote(
	author: { userId: string; access: PageAccess; via?: string },
	noteId: string,
	rawPath: string
): Promise<FileResult> {
	const note = await getNote(author.userId, noteId);
	if (!note) return { ok: false, message: 'Diese Notiz gibt es nicht (mehr).' };
	const path = slugifyPath(rawPath);
	if (!path) return { ok: false, message: `„${rawPath}“ ist kein gültiger Seitenpfad.` };
	if (!author.access.canEdit(path)) {
		return { ok: false, message: `Du darfst „${path}“ nicht bearbeiten.` };
	}

	const text = note.content.trim();
	const existing = await getPageWithLatestVersion(path);
	try {
		if (existing) {
			await addPageVersion({
				pageId: existing.page.id,
				title: existing.version.title,
				content: `${existing.version.content.trimEnd()}\n\n${text}\n`,
				baseVersion: existing.version.versionNumber,
				authorId: author.userId,
				via: author.via,
				changeSummary: 'Aus der Inbox einsortiert'
			});
		} else {
			const heading = titleFromMarkdown(text);
			const title = (heading || titleFromPath(path)).slice(0, 200);
			await createPage({
				path,
				title,
				content: heading ? `${text}\n` : `# ${title}\n\n${text}\n`,
				authorId: author.userId,
				via: author.via,
				changeSummary: 'Aus der Inbox angelegt'
			});
		}
	} catch (err) {
		if (!(err instanceof PageConflictError)) throw err;
		return { ok: false, message: 'Die Seite wurde gerade geändert – versuch es noch einmal.' };
	}

	await deleteNote(author.userId, noteId);
	return { ok: true, path, created: !existing };
}

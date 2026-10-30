import { fail, redirect } from '@sveltejs/kit';
import { addNote, deleteNote, listNotes } from '$lib/server/repo/inbox';
import { listPages } from '$lib/server/repo/pages';
import { fileNote, MAX_NOTE_LENGTH } from '$lib/server/inbox';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/** The inbox is a person's own: without login there is none. */
function requireUser(event: RequestEvent | Parameters<PageServerLoad>[0]) {
	const user = event.locals.user;
	if (!user) redirect(303, `/login?redirectTo=${encodeURIComponent(event.url.pathname)}`);
	return user;
}

export const load: PageServerLoad = async (event) => {
	const user = requireUser(event);
	const [notes, pages] = await Promise.all([listNotes(user.id), listPages()]);
	return {
		notes,
		// Suggestions where to sort a note in: the pages one may edit.
		paths: pages.map((p) => p.path).filter((path) => event.locals.access.canEdit(path))
	};
};

const field = (form: FormData, name: string) => form.get(name)?.toString().trim() ?? '';

export const actions: Actions = {
	add: async (event) => {
		const user = requireUser(event);
		const content = field(await event.request.formData(), 'content');
		if (!content) return fail(400, { message: 'Schreib etwas in die Notiz.' });
		if (content.length > MAX_NOTE_LENGTH) {
			return fail(400, { message: 'Die Notiz ist zu lang.', content });
		}
		await addNote({ userId: user.id, content });
	},

	file: async (event) => {
		const user = requireUser(event);
		const form = await event.request.formData();
		const result = await fileNote(
			{ userId: user.id, access: event.locals.access },
			field(form, 'noteId'),
			field(form, 'path')
		);
		if (!result.ok) return fail(400, { message: result.message });
		redirect(303, `/w/${result.path}`);
	},

	delete: async (event) => {
		const user = requireUser(event);
		await deleteNote(user.id, field(await event.request.formData(), 'noteId'));
	}
};

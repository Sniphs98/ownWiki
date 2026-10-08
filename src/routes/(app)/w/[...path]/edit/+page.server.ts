import { error, fail, redirect } from '@sveltejs/kit';
import { requireEditAccess } from '$lib/server/require-edit-access';
import {
	addPageVersion,
	createPage,
	deletePage,
	getPageWithLatestVersion,
	PageConflictError
} from '$lib/server/repo/pages';
import { listAttachmentsForPage } from '$lib/server/repo/attachments';
import { getCover } from '$lib/server/repo/covers';
import { slugifyPath } from '$lib/slug';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireEditAccess(event);

	const path = event.params.path;
	const existing = await getPageWithLatestVersion(path);

	// New pages only get the canonical path the "Neue Seite" dialog and
	// wiki links produce ("Personal/Kündigung" → "personal/kuendigung").
	const slug = slugifyPath(path);
	if (!existing && slug !== path) {
		if (!slug) error(400, 'Ungültiger Seitenpfad');
		const title = event.url.searchParams.get('title') ?? path.split('/').at(-1) ?? '';
		redirect(303, `/w/${slug}/edit?title=${encodeURIComponent(title)}`);
	}

	return {
		path,
		page: existing?.page ?? null,
		version: existing?.version ?? null,
		prefillTitle: existing?.version.title ?? event.url.searchParams.get('title') ?? '',
		// Files shown on the PDF title page aren't "unlinked" (unlinked-files.svelte).
		attachments: existing ? await attachmentsOutsideCover(existing.page.id) : []
	};
};

async function attachmentsOutsideCover(pageId: string) {
	const [attachments, cover] = await Promise.all([
		listAttachmentsForPage(pageId),
		getCover(pageId)
	]);
	return attachments.filter((file) => !cover?.includes(`/api/files/${file.id}`));
}

export const actions: Actions = {
	save: async (event) => {
		requireEditAccess(event);

		const path = event.params.path;
		const formData = await event.request.formData();
		const title = formData.get('title')?.toString().trim() ?? '';
		const content = formData.get('content')?.toString() ?? '';
		const changeSummary = formData.get('changeSummary')?.toString().trim() || undefined;

		if (!title) {
			return fail(400, { message: 'Titel darf nicht leer sein.' });
		}

		// The version the editor was opened on, 0 for a new page. The last
		// value wins: "Trotzdem speichern" overrides the form's hidden field.
		const baseVersion = Number(formData.getAll('baseVersion').at(-1) ?? 0);

		const authorId = event.locals.user?.id;
		const existing = await getPageWithLatestVersion(path);
		if (!existing && slugifyPath(path) !== path) {
			return fail(400, { message: 'Ungültiger Seitenpfad.' });
		}

		try {
			if (existing) {
				await addPageVersion({
					pageId: existing.page.id,
					title,
					content,
					changeSummary,
					authorId,
					baseVersion
				});
			} else {
				await createPage({ path, title, content, changeSummary, authorId });
			}
		} catch (err) {
			if (!(err instanceof PageConflictError)) throw err;
			return fail(409, {
				message:
					`Jemand anderes hat die Seite inzwischen gespeichert (jetzt Version ${err.latestVersion}). ` +
					'Speichern würde diese Änderungen überschreiben.',
				conflictVersion: err.latestVersion
			});
		}

		redirect(303, `/w/${path}`);
	},

	delete: async (event) => {
		requireEditAccess(event);

		const existing = await getPageWithLatestVersion(event.params.path);
		if (!existing) error(404, 'Seite nicht gefunden');

		await deletePage(existing.page.id);

		redirect(303, '/');
	}
};

import { fail, redirect } from '@sveltejs/kit';
import { requireEditAccess } from '$lib/server/require-edit-access';
import { addPageVersion, createPage, getPageWithLatestVersion } from '$lib/server/repo/pages';
import { listAttachmentsForPage } from '$lib/server/repo/attachments';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireEditAccess(event);

	const path = event.params.path;
	const existing = await getPageWithLatestVersion(path);

	return {
		path,
		page: existing?.page ?? null,
		version: existing?.version ?? null,
		prefillTitle: existing?.version.title ?? event.url.searchParams.get('title') ?? '',
		attachments: existing ? await listAttachmentsForPage(existing.page.id) : []
	};
};

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

		const authorId = event.locals.user?.id;
		const existing = await getPageWithLatestVersion(path);

		if (existing) {
			await addPageVersion({ pageId: existing.page.id, title, content, changeSummary, authorId });
		} else {
			await createPage({ path, title, content, changeSummary, authorId });
		}

		redirect(303, `/w/${path}`);
	}
};

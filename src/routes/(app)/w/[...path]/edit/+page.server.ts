import { error, fail, redirect } from '@sveltejs/kit';
import { requireEditAccess } from '$lib/server/require-edit-access';
import { requireEdit } from '$lib/server/access';
import {
	addPageVersion,
	createPage,
	deletePage,
	getPageWithLatestVersion,
	listPages,
	PageConflictError
} from '$lib/server/repo/pages';
import { listAttachmentsForPage } from '$lib/server/repo/attachments';
import { getCover } from '$lib/server/repo/covers';
import { setTags, tagsOf } from '$lib/server/repo/tags';
import { parseTags } from '$lib/tags';
import { refreshWikiLinks } from '$lib/wiki-links';
import { linkBindings } from '$lib/server/backlinks';
import { movedPath } from '$lib/server/move';
import { slugifyPath } from '$lib/slug';
import { titleFromMarkdown } from '$lib/page-title';
import type { Actions, PageServerLoad } from './$types';
import { basePath, withBase } from '$lib/base-path';
import { addBasePath, removeBasePath } from '$lib/content-paths';

export const load: PageServerLoad = async (event) => {
	requireEditAccess(event);

	const path = event.params.path;
	requireEdit(event.locals.access, path);
	const existing = await getPageWithLatestVersion(path);
	if (!existing) {
		const movedTo = await movedPath(path);
		if (movedTo) redirect(303, withBase(`/w/${movedTo}/edit`));
	}

	// New pages only get the canonical path the "Neue Seite" dialog and
	// wiki links produce ("Personal/Kündigung" → "personal/kuendigung").
	const slug = slugifyPath(path);
	if (!existing && slug !== path) {
		if (!slug) error(400, 'Ungültiger Seitenpfad');
		const title = event.url.searchParams.get('title') ?? path.split('/').at(-1) ?? '';
		redirect(303, withBase(`/w/${slug}/edit?title=${encodeURIComponent(title)}`));
	}

	return {
		path,
		page: existing?.page ?? null,
		// Links to renamed or moved pages already read as those pages are called now.
		version: existing ? await withCurrentLinks(existing, event.locals.access) : null,
		prefillTitle: existing?.version.title ?? event.url.searchParams.get('title') ?? '',
		tags: existing ? await tagsOf(existing.page.id) : [],
		// Files shown on the PDF title page aren't "unlinked" (unlinked-files.svelte).
		attachments: existing ? await attachmentsOutsideCover(existing.page.id) : []
	};
};

async function withCurrentLinks(
	existing: NonNullable<Awaited<ReturnType<typeof getPageWithLatestVersion>>>,
	access: App.Locals['access']
) {
	const pages = access.readable(await listPages());
	const bindings = await linkBindings(existing.page.id, pages);
	return {
		...existing.version,
		content: addBasePath(refreshWikiLinks(existing.version.content, pages, bindings), basePath)
	};
}

async function attachmentsOutsideCover(pageId: string) {
	const [attachments, cover] = await Promise.all([
		listAttachmentsForPage(pageId),
		getCover(pageId)
	]);
	return attachments.filter((file) => !cover?.content.includes(`/api/files/${file.id}`));
}

export const actions: Actions = {
	save: async (event) => {
		requireEditAccess(event);

		const path = event.params.path;
		requireEdit(event.locals.access, path);
		const formData = await event.request.formData();
		const content = removeBasePath(formData.get('content')?.toString() ?? '', basePath);
		// The editor has no title field: the heading on the text's first line
		// is the title; without one the page keeps its title.
		const existing = await getPageWithLatestVersion(path);
		const title =
			formData.get('title')?.toString().trim() ||
			titleFromMarkdown(content).slice(0, 200) ||
			existing?.version.title;

		if (!title) {
			return fail(400, { message: 'Beginne die Seite mit einer Überschrift – sie ist ihr Titel.' });
		}

		// The version the editor was opened on, 0 for a new page. The last
		// value wins: "Trotzdem speichern" overrides the form's hidden field.
		const baseVersion = Number(formData.getAll('baseVersion').at(-1) ?? 0);

		const authorId = event.locals.user?.id;
		// Opened on a page that someone moved meanwhile: don't make a new one here.
		const movedTo = !existing && baseVersion > 0 ? await movedPath(path) : null;
		if (movedTo) {
			return fail(409, {
				message:
					`Die Seite wurde inzwischen nach „${movedTo}“ verschoben. ` +
					'Kopiere deine Änderungen und öffne sie dort neu.'
			});
		}
		if (!existing && slugifyPath(path) !== path) {
			return fail(400, { message: 'Ungültiger Seitenpfad.' });
		}

		try {
			let pageId = existing?.page.id;
			if (existing) {
				await addPageVersion({
					pageId: existing.page.id,
					title,
					content,
					authorId,
					baseVersion
				});
			} else {
				pageId = await createPage({ path, title, content, authorId });
			}
			// Left as they are by a form without the field.
			const tags = formData.get('tags');
			if (pageId && tags !== null) await setTags(pageId, parseTags(tags.toString()));
		} catch (err) {
			if (!(err instanceof PageConflictError)) throw err;
			return fail(409, {
				message:
					`Jemand anderes hat die Seite inzwischen gespeichert (jetzt Version ${err.latestVersion}). ` +
					'Speichern würde diese Änderungen überschreiben.',
				conflictVersion: err.latestVersion
			});
		}

		redirect(303, withBase(`/w/${path}`));
	},

	delete: async (event) => {
		requireEditAccess(event);
		requireEdit(event.locals.access, event.params.path);

		const existing = await getPageWithLatestVersion(event.params.path);
		if (!existing) error(404, 'Seite nicht gefunden');

		await deletePage(existing.page.id);

		redirect(303, withBase('/'));
	}
};

import { error, fail, redirect } from '@sveltejs/kit';
import { getPageWithLatestVersion, listPages } from '$lib/server/repo/pages';
import { movedPath, movePage } from '$lib/server/move';
import { getCover } from '$lib/server/repo/covers';
import { resolveWikiLinks } from '$lib/wiki-links';
import { requireEdit, requireRead } from '$lib/server/access';
import { findBacklinks, linkBindings } from '$lib/server/backlinks';
import { tagsOf } from '$lib/server/repo/tags';
import type { Actions, PageServerLoad } from './$types';
import { basePath, withBase } from '$lib/base-path';
import { addBasePath } from '$lib/content-paths';

export const load: PageServerLoad = async (event) => {
	const { access } = event.locals;
	requireRead(access, event.params.path);
	const result = await getPageWithLatestVersion(event.params.path);
	if (!result) {
		// No page here, but pages below it: a folder, shown as a list of them.
		const below = `${event.params.path}/`;
		const pages = access.readable(await listPages());
		if (!pages.some((p) => p.path.startsWith(below))) {
			// A page that was moved away from here: on to where it is now.
			const movedTo = await movedPath(event.params.path);
			if (movedTo && access.canRead(movedTo))
				redirect(301, withBase(`/w/${movedTo}${event.url.search}`));
			error(404, 'Seite nicht gefunden');
		}
		return {
			kind: 'folder' as const,
			path: event.params.path,
			canEdit: access.canEdit(event.params.path)
		};
	}

	const [allPages, cover, backlinks, tags] = await Promise.all([
		listPages(),
		getCover(result.page.id),
		findBacklinks(result.page.path, access),
		tagsOf(result.page.id)
	]);
	// Links to pages the visitor can't see read like links to missing ones.
	const pages = access.readable(allPages);
	const bindings = await linkBindings(result.page.id, pages);

	return {
		kind: 'page' as const,
		page: result.page,
		version: {
			...result.version,
			content: addBasePath(resolveWikiLinks(result.version.content, pages, bindings), basePath)
		},
		/** The page's PDF title page (pdf-export-dialog.svelte), if it has one. */
		cover: cover && { ...cover, content: addBasePath(cover.content, basePath) },
		tags,
		/** The pages linking here, as far as the visitor may see them. */
		backlinks: backlinks.map(({ path, title }) => ({ path, title })),
		canEdit: access.canEdit(result.page.path)
	};
};

export const actions: Actions = {
	/** Moves this page or folder, with everything below it (move.ts). */
	move: async (event) => {
		const from = event.params.path;
		requireEdit(event.locals.access, from);
		const to = (await event.request.formData()).get('to')?.toString() ?? '';
		const result = await movePage(
			from,
			to,
			{ userId: event.locals.user?.id, access: event.locals.access },
			event.locals.authMode
		);
		if (!result.ok) return fail(400, { moveError: result.message });
		redirect(303, withBase(`/w/${result.plan.to}`));
	}
};

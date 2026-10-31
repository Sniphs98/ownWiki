import { error, redirect } from '@sveltejs/kit';
import {
	addPageVersion,
	getPageWithLatestVersion,
	listPages,
	listVersions
} from '$lib/server/repo/pages';
import { resolveWikiLinks } from '$lib/wiki-links';
import { linkBindings } from '$lib/server/backlinks';
import { requireEdit, requireRead } from '$lib/server/access';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const path = event.params.path;
	const { access } = event.locals;
	requireRead(access, path);
	const result = await getPageWithLatestVersion(path);
	if (!result) error(404, 'Seite nicht gefunden');

	const [versions, allPages] = await Promise.all([listVersions(result.page.id), listPages()]);
	const pages = access.readable(allPages);
	// Older versions resolve like the latest one: by what its links are bound to.
	const bindings = await linkBindings(result.page.id, pages);

	return {
		path,
		page: result.page,
		canEdit: access.canEdit(path),
		versions: versions.map((version) => ({
			...version,
			content: resolveWikiLinks(version.content, pages, bindings)
		}))
	};
};

export const actions: Actions = {
	restore: async (event) => {
		const path = event.params.path;
		requireEdit(event.locals.access, path);
		const formData = await event.request.formData();
		const versionNumber = Number(formData.get('versionNumber'));

		const result = await getPageWithLatestVersion(path);
		if (!result) error(404, 'Seite nicht gefunden');

		const versions = await listVersions(result.page.id);
		const target = versions.find((v) => v.versionNumber === versionNumber);
		if (!target) error(404, 'Version nicht gefunden');

		await addPageVersion({
			pageId: result.page.id,
			title: target.title,
			content: target.content,
			changeSummary: `Wiederhergestellt: Version ${versionNumber}`,
			authorId: event.locals.user?.id
		});

		redirect(303, `/w/${path}`);
	}
};

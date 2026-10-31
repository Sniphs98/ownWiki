import { error, redirect } from '@sveltejs/kit';
import { getPagePath } from '$lib/server/repo/pages';
import type { RequestHandler } from './$types';
import { withBase } from '$lib/base-path';

/**
 * A page's permanent address: by its id, so it keeps working wherever the
 * page is moved. Leads to where the page is now.
 */
export const GET: RequestHandler = async ({ locals, params }) => {
	const path = await getPagePath(params.id);
	if (!path || !locals.access.canRead(path)) error(404, 'Seite nicht gefunden');
	redirect(303, withBase(`/w/${path}`));
};

import { error } from '@sveltejs/kit';
import { getPageWithLatestVersion } from '$lib/server/repo/pages';
import { setCover } from '$lib/server/repo/covers';
import { coverAlignX, coverAlignY } from '$lib/cover';
import { requireEdit } from '$lib/server/access';
import type { RequestHandler } from './$types';
import { basePath } from '$lib/base-path';
import { removeBasePath } from '$lib/content-paths';

/** A title page is markdown with image links, not the images themselves. */
const MAX_COVER_LENGTH = 100_000;

/** Saves the page's PDF title page; empty content removes it. */
export const PUT: RequestHandler = async (event) => {
	if (event.locals.authMode !== 'disabled' && !event.locals.user) {
		error(401, 'Zum Ändern der Titelseite bitte anmelden.');
	}
	requireEdit(event.locals.access, event.params.path);
	const body = await event.request.json().catch(() => null);
	// Stored without the base path the dialog's editor shows its links with.
	const content = typeof body?.content === 'string' ? removeBasePath(body.content, basePath) : null;
	if (content === null) error(400, 'content fehlt.');
	if (content.length > MAX_COVER_LENGTH) error(413, 'Die Titelseite ist zu lang.');

	const found = await getPageWithLatestVersion(event.params.path);
	if (!found) error(404, 'Seite nicht gefunden');

	await setCover(
		found.page.id,
		content.trim()
			? { content, alignX: coverAlignX(body.alignX), alignY: coverAlignY(body.alignY) }
			: null
	);
	return new Response(null, { status: 204 });
};

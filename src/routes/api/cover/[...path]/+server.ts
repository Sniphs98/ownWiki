import { error } from '@sveltejs/kit';
import { getPageWithLatestVersion } from '$lib/server/repo/pages';
import { setCover } from '$lib/server/repo/covers';
import type { RequestEvent, RequestHandler } from './$types';

/** A title page is markdown with image links, not the images themselves. */
const MAX_COVER_LENGTH = 100_000;

async function pageIdFor(event: RequestEvent): Promise<string> {
	const found = await getPageWithLatestVersion(event.params.path);
	if (!found) error(404, 'Seite nicht gefunden');
	return found.page.id;
}

/** Saves the title page; empty content removes it. */
export const PUT: RequestHandler = async (event) => {
	if (event.locals.authMode !== 'disabled' && !event.locals.user) {
		error(401, 'Zum Ändern der Titelseite bitte anmelden.');
	}
	const body = await event.request.json().catch(() => null);
	const content = typeof body?.content === 'string' ? body.content : null;
	if (content === null) error(400, 'content fehlt.');
	if (content.length > MAX_COVER_LENGTH) error(413, 'Die Titelseite ist zu lang.');

	await setCover(await pageIdFor(event), content.trim() ? content : null);
	return new Response(null, { status: 204 });
};

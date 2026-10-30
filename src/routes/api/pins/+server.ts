import { error, json } from '@sveltejs/kit';
import { pin, unpin } from '$lib/server/repo/pins';
import { slugifyPath } from '$lib/slug';
import type { RequestHandler } from './$types';

/** Pins a page or folder in the tree for the person logged in, or unpins it: { path, pinned }. */
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Melde dich an, um Seiten anzupinnen.');
	const body = (await request.json().catch(() => null)) as { path?: unknown; pinned?: unknown };
	const path = typeof body?.path === 'string' ? slugifyPath(body.path) : '';
	if (!path || typeof body?.pinned !== 'boolean') error(400, 'Erwartet: { path, pinned }');

	if (body.pinned) await pin(locals.user.id, path);
	else await unpin(locals.user.id, path);
	return json({ path, pinned: body.pinned });
};

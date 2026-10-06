import { error, json } from '@sveltejs/kit';
import { setToolbar } from '$lib/server/repo/preferences';
import { normalizeToolbar } from '$lib/toolbar';
import type { RequestHandler } from './$types';

/** Saves the signed-in user's preferences (see $lib/toolbar-setting.svelte.ts). */
export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Nicht angemeldet');

	const body = await request.json().catch(() => error(400, 'Ungültige Anfrage'));
	const toolbar = body?.toolbar === null ? null : normalizeToolbar(body?.toolbar);
	await setToolbar(locals.user.id, toolbar);
	return json({ toolbar });
};

import { error, json } from '@sveltejs/kit';
import { planMove } from '$lib/server/move';
import type { RequestHandler } from './$types';

/**
 * What moving a page or folder would do, for the move dialog: where it ends
 * up, how many pages go along, how many link to it and who would gain or
 * lose reading it — or why it can't.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	if (!from || !locals.access.canRead(from)) error(404, 'Seite nicht gefunden');

	const result = await planMove(from, to, locals.access, locals.authMode);
	if (!result.ok) return json({ ok: false, message: result.message });
	const { plan } = result;
	return json({
		ok: true,
		to: plan.to,
		pages: plan.moves.length,
		backlinks: plan.backlinks,
		readers: plan.readers
	});
};

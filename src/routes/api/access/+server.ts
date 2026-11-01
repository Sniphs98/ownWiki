import { error, json } from '@sveltejs/kit';
import { areasOf } from '$lib/access';
import { listGroups, listRules, listUsers } from '$lib/server/repo/access';
import { slugifyPath } from '$lib/slug';
import type { RequestHandler } from './$types';

/**
 * The access rules that count for one page or folder — its own and those of
 * the areas above it, nearest first — with the groups and people a rule can
 * be for. For the rights dialog in the tree; admins only, like /verwaltung,
 * whose actions it changes the rules with.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.access.isAdmin) error(403, 'Nur für Admins.');
	const path = slugifyPath(url.searchParams.get('path') ?? '');
	if (!path) error(400, 'Erwartet: ?path=');

	const areas = areasOf(path);
	const [rules, groups, users] = await Promise.all([listRules(), listGroups(), listUsers()]);
	return json({
		path,
		rules: rules
			.filter((rule) => areas.includes(rule.path))
			.sort((a, b) => areas.indexOf(a.path) - areas.indexOf(b.path)),
		groups: groups.map(({ id, name }) => ({ id, name })),
		users: users.map(({ id, name, email }) => ({ id, name, email }))
	});
};

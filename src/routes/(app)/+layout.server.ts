import { listPages } from '$lib/server/repo/pages';
import { getUserPreferences } from '$lib/server/repo/preferences';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const pages = event.locals.access.readable(await listPages());

	const user = event.locals.user;
	const preferences = user ? await getUserPreferences(user.id) : null;

	return {
		pages,
		user,
		authMode: event.locals.authMode,
		isAdmin: event.locals.access.isAdmin,
		toolbar: preferences?.toolbar ?? null
	};
};

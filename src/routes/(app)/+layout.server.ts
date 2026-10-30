import { listPages } from '$lib/server/repo/pages';
import { getUserPreferences } from '$lib/server/repo/preferences';
import { countNotes } from '$lib/server/repo/inbox';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const pages = event.locals.access.readable(await listPages());

	const user = event.locals.user;
	const [preferences, inboxCount] = user
		? await Promise.all([getUserPreferences(user.id), countNotes(user.id)])
		: [null, 0];

	return {
		pages,
		user,
		authMode: event.locals.authMode,
		isAdmin: event.locals.access.isAdmin,
		/** Notes in the person's inbox, shown on its button. */
		inboxCount,
		toolbar: preferences?.toolbar ?? null
	};
};

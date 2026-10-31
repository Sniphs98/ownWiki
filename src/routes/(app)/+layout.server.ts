import { listPages } from '$lib/server/repo/pages';
import { getUserPreferences } from '$lib/server/repo/preferences';
import { countNotes } from '$lib/server/repo/inbox';
import { pinnedPaths } from '$lib/server/repo/pins';
import { loginEnabled } from '$lib/server/login';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const pages = event.locals.access.readable(await listPages());

	const user = event.locals.user;
	const [preferences, inboxCount, pinned] = user
		? await Promise.all([getUserPreferences(user.id), countNotes(user.id), pinnedPaths(user.id)])
		: [null, 0, []];

	return {
		pages,
		user,
		authMode: event.locals.authMode,
		isAdmin: event.locals.access.isAdmin,
		/** Notes in the person's inbox, shown on its button. */
		inboxCount,
		/** No login at all (see loginMethods): no account menu either. */
		loginEnabled,
		/** Pages and folders the person pinned in the tree. */
		pinned,
		toolbar: preferences?.toolbar ?? null
	};
};

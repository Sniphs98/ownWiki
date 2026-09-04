import { listPages } from '$lib/server/repo/pages';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const pages = await listPages();

	return {
		pages,
		user: event.locals.user,
		authMode: event.locals.authMode
	};
};

import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Guards a route that lets the user create or edit content. Unlike the
 * generic AUTH_MODE gating in hooks.server.ts (which only blocks writes,
 * not the GET request for the edit UI itself), editing always needs a
 * session unless AUTH_MODE=disabled — otherwise an anonymous visitor could
 * open the editor, write content, and only get bounced to /login on save.
 */
export function requireEditAccess(event: RequestEvent) {
	if (event.locals.authMode !== 'disabled' && !event.locals.user) {
		const redirectTo = event.url.pathname + event.url.search;
		redirect(303, `/login?redirectTo=${encodeURIComponent(redirectTo)}`);
	}
}

import type { Handle } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { authMode } from '$lib/server/auth-mode';
import { PDF_INTERNAL_TOKEN, PDF_INTERNAL_TOKEN_HEADER } from '$lib/server/pdf/internal-token';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// Always reachable, regardless of AUTH_MODE — otherwise nobody could ever
// log in on a `full` (private) wiki.
const PUBLIC_PATHS = new Set(['/login']);
const PUBLIC_PATH_PREFIXES = ['/api/auth/'];

function isPublicPath(pathname: string) {
	return (
		PUBLIC_PATHS.has(pathname) || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
	);
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const handleAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	event.locals.authMode = authMode;

	if (!building && !isPublicPath(event.url.pathname)) {
		const requiresAuth =
			authMode === 'full' || (authMode === 'read-only' && WRITE_METHODS.has(event.request.method));

		// The PDF generator (generate-pdf.ts) navigates here from a loopback
		// Playwright browser to render /print/... for screenshotting — it has
		// no real session, so it authenticates with this process-local secret
		// instead.
		const hasInternalToken =
			event.request.headers.get(PDF_INTERNAL_TOKEN_HEADER) === PDF_INTERNAL_TOKEN;

		if (requiresAuth && !session && !hasInternalToken) {
			if (event.request.headers.get('accept')?.includes('text/html')) {
				const redirectTo = event.url.pathname + event.url.search;
				redirect(303, `/login?redirectTo=${encodeURIComponent(redirectTo)}`);
			}
			error(401, 'Authentication required');
		}
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleAuth;

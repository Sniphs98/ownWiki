import type { Handle, ServerInit } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { authMode } from '$lib/server/auth-mode';
import { isCrossSiteForm } from '$lib/server/csrf';
import {
	PDF_INTERNAL_TOKEN,
	PDF_INTERNAL_TOKEN_HEADER,
	PDF_INTERNAL_USER_HEADER
} from '$lib/server/pdf/internal-token';
import { accessFor } from '$lib/server/access';
import { getUserRole } from '$lib/server/repo/access';
import { startSemanticIndex } from '$lib/server/search';
import { rebuildLinks } from '$lib/server/backlinks';
import { svelteKitHandler } from 'better-auth/svelte-kit';

// Always reachable, regardless of AUTH_MODE — otherwise nobody could ever
// log in on a `full` (private) wiki.
// /mcp checks the AI assistant's access token instead of a session, and
// /.well-known/ tells assistants where to get one.
const PUBLIC_PATHS = new Set(['/login', '/mcp']);
const PUBLIC_PATH_PREFIXES = ['/api/auth/', '/.well-known/'];

function isPublicPath(pathname: string) {
	return (
		PUBLIC_PATHS.has(pathname) || PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
	);
}

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const handleAuth: Handle = async ({ event, resolve }) => {
	if (isCrossSiteForm(event.request, event.url)) {
		error(403, `Cross-site ${event.request.method} form submissions are forbidden`);
	}

	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	event.locals.authMode = authMode;

	// The PDF generator (generate-pdf.ts) navigates here from a loopback
	// Playwright browser to render /print/... for screenshotting — it has
	// no real session, so it authenticates with this process-local secret
	// instead, and names the person the PDF is for. It only ever reads.
	const hasInternalToken =
		!WRITE_METHODS.has(event.request.method) &&
		event.request.headers.get(PDF_INTERNAL_TOKEN_HEADER) === PDF_INTERNAL_TOKEN;

	if (!building) {
		const pdfUserId = hasInternalToken ? event.request.headers.get(PDF_INTERNAL_USER_HEADER) : null;
		const viewer = pdfUserId
			? { id: pdfUserId, role: await getUserRole(pdfUserId) }
			: event.locals.user;
		event.locals.access = await accessFor(viewer, authMode);
	}

	if (!building && !isPublicPath(event.url.pathname)) {
		const requiresAuth =
			authMode === 'full' || (authMode === 'read-only' && WRITE_METHODS.has(event.request.method));

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

export const init: ServerInit = async () => {
	if (building) return;
	await rebuildLinks();
	// Embeds pages saved before semantic search was set up, in the background.
	void startSemanticIndex();
};

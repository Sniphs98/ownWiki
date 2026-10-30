const FORM_CONTENT_TYPES = [
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain'
];
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * OAuth endpoints that AI assistants' servers call directly, with a form
 * body and no Origin header. They don't act on a login cookie — the client
 * proves itself (PKCE, client credentials) — so a forged form gains nothing.
 */
const SERVER_TO_SERVER_PATHS = new Set([
	'/api/auth/oauth2/token',
	'/api/auth/oauth2/register',
	'/api/auth/oauth2/revoke',
	'/api/auth/oauth2/introspect'
]);

/**
 * SvelteKit's CSRF protection, with an exception for SERVER_TO_SERVER_PATHS
 * (SvelteKit's own check can only be switched off as a whole, see
 * vite.config.ts): a form sent from another site — or from no site at all —
 * that would change something.
 */
export function isCrossSiteForm(request: Request, url: URL): boolean {
	if (!WRITE_METHODS.has(request.method) || SERVER_TO_SERVER_PATHS.has(url.pathname)) return false;
	const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
	if (!FORM_CONTENT_TYPES.includes(contentType)) return false;
	return request.headers.get('origin') !== url.origin;
}

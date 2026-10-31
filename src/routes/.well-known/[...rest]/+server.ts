import { auth } from '$lib/server/auth';
import { basePath } from '$lib/base-path';
import type { RequestHandler } from './$types';

/**
 * OAuth discovery for AI assistants: where to log in (authorization server
 * metadata) and what protects /mcp (protected resource metadata). Better
 * Auth serves these documents, but only sees requests under /api/auth on
 * its own — this hands it the ones at the root, where clients look.
 *
 * Under BASE_PATH, clients still ask at the domain's root
 * (/.well-known/oauth-protected-resource/wiki/mcp); the reverse proxy
 * passes that on with the base path in front (see the README). Better
 * Auth answers it as it would at the root.
 */
export const GET: RequestHandler = ({ request, url }) => {
	if (!basePath) return auth.handler(request);
	const atRoot = new URL(url);
	atRoot.pathname = url.pathname.slice(basePath.length);
	return auth.handler(new Request(atRoot, request));
};

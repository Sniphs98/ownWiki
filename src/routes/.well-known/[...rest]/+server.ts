import { auth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * OAuth discovery for AI assistants: where to log in (authorization server
 * metadata) and what protects /mcp (protected resource metadata). Better
 * Auth serves these documents, but only sees requests under /api/auth on
 * its own — this hands it the ones at the root, where clients look.
 */
export const GET: RequestHandler = ({ request }) => auth.handler(request);

import { error } from '@sveltejs/kit';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { env } from '$env/dynamic/private';
import { createWikiMcpServer } from '$lib/server/mcp/server';
import { isMcpToken, requestMcpToken } from '$lib/server/mcp/token';
import type { RequestHandler } from './$types';

/**
 * The MCP endpoint for AI assistants (Streamable HTTP). It has its own
 * credential, MCP_TOKEN, instead of a login session — hooks.server.ts lets
 * /mcp through for that. Without MCP_TOKEN set, it doesn't exist.
 *
 * Stateless: every request gets a fresh server and transport, so nothing
 * has to be kept between requests (or survive a restart).
 */
const handle: RequestHandler = async ({ request, params, url }) => {
	if (!env.MCP_TOKEN) error(404, 'Not found');
	if (!isMcpToken(requestMcpToken(request, params.token), env.MCP_TOKEN)) {
		error(401, 'Invalid MCP token');
	}

	const server = createWikiMcpServer(url.origin);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	});
	await server.connect(transport);
	return transport.handleRequest(request);
};

export const GET = handle;
export const POST = handle;
export const DELETE = handle;

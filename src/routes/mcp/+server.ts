import { error } from '@sveltejs/kit';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { requireMcpAuth } from '@better-auth/mcp';
import { auth, mcpResource } from '$lib/server/auth';
import { internalOrigin } from '$lib/server/internal-origin';
import { createWikiMcpServer, type McpActor } from '$lib/server/mcp/server';
import type { RequestHandler } from './$types';

/**
 * The person an access token was issued to (`sub`) and the name the
 * assistant registered under (`azp` is its client id), for the history.
 */
async function actorFrom(claims: { sub?: string; azp?: unknown }): Promise<McpActor> {
	const { adapter } = await auth.$context;
	const client =
		typeof claims.azp === 'string'
			? await adapter.findOne<{ name?: string | null }>({
					model: 'oauthClient',
					where: [{ field: 'clientId', value: claims.azp }]
				})
			: null;
	return { userId: claims.sub ?? '', via: client?.name || 'KI-Assistent' };
}

/** Answers one MCP request: a fresh server and transport each time, nothing kept between requests. */
async function answer(request: Request, origin: string, actor: McpActor) {
	const server = createWikiMcpServer(origin, actor);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	});
	await server.connect(transport);
	return transport.handleRequest(request);
}

const protectedHandlers = new Map<string, (request: Request) => Promise<Response>>();

/**
 * The MCP endpoint for AI assistants (Streamable HTTP). Each request needs
 * an OAuth access token the wiki issued for this endpoint — see the mcp()
 * plugin in auth.ts. Without one, the answer tells the assistant where to
 * log in. hooks.server.ts lets /mcp through for that.
 *
 * The token's signature is checked against the wiki's own signing keys,
 * fetched over loopback rather than the public address.
 */
export const POST: RequestHandler = async ({ request, url }) => {
	if (!mcpResource) error(404, 'Not found');

	const jwksUrl = `${internalOrigin(url)}/api/auth/jwks`;
	let handler = protectedHandlers.get(jwksUrl);
	if (!handler) {
		handler = requireMcpAuth(
			auth,
			async (req, claims) => answer(req, url.origin, await actorFrom(claims)),
			{
				resource: mcpResource,
				jwksUrl
			}
		);
		protectedHandlers.set(jwksUrl, handler);
	}
	return handler(request);
};

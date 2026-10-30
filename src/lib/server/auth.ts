import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { jwt } from 'better-auth/plugins';
import { mcp } from '@better-auth/mcp';
import { getRequestEvent } from '$app/server';
import { db, dbDialect } from '$lib/server/db';
import { isSignupAllowed } from '$lib/server/signup';

/**
 * The MCP endpoint's address, which AI assistants' access tokens are bound
 * to. Needs ORIGIN — without it, there's no MCP endpoint.
 */
export const mcpResource = env.ORIGIN ? new URL('/mcp', env.ORIGIN).href : undefined;

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: dbDialect === 'postgresql' ? 'pg' : 'sqlite' }),
	emailAndPassword: { enabled: true },
	// The JWT plugin's own /token endpoint isn't needed: access tokens come
	// from the OAuth provider's /oauth2/token.
	disabledPaths: ['/token'],
	databaseHooks: {
		user: {
			create: {
				// Enforced here rather than in the login form, so the public
				// /api/auth/sign-up endpoint is covered as well.
				before: async () => {
					if (!(await isSignupAllowed())) {
						throw new APIError('FORBIDDEN', { message: 'Die Registrierung ist deaktiviert.' });
					}
				}
			}
		}
	},
	plugins: [
		// Makes the wiki an OAuth provider for AI assistants (ChatGPT, Claude):
		// each person connects once with their own login, and the assistant
		// then acts as them. Assistants register themselves (dynamic client
		// registration), as ChatGPT's connectors do.
		...(mcpResource
			? [
					jwt(),
					mcp({
						resource: mcpResource,
						loginPage: '/login',
						consentPage: '/consent',
						scopes: ['openid', 'profile', 'email', 'offline_access'],
						allowDynamicClientRegistration: true,
						allowUnauthenticatedClientRegistration: true,
						clientRegistrationDefaultApplicationType: 'infer'
					})
				]
			: []),
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});

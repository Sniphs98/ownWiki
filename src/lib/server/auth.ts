import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { jwt } from 'better-auth/plugins';
import { mcp } from '@better-auth/mcp';
import { getRequestEvent } from '$app/server';
import { withBase } from '$lib/base-path';
import { db, dbDialect } from '$lib/server/db';
import { hasUsers, isSignupAllowed } from '$lib/server/signup';
import { loginEnabled, microsoftLogin, passwordLogin } from '$lib/server/login';

/**
 * The MCP endpoint's address, which AI assistants' access tokens are bound
 * to. Needs ORIGIN — and a login, since an assistant acts as the person who
 * connected it. Without either, there's no MCP endpoint.
 */
export const mcpResource =
	env.ORIGIN && loginEnabled ? new URL(withBase('/mcp'), env.ORIGIN).href : undefined;

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	// Under BASE_PATH too, like every route; Microsoft calls back to …/api/auth/callback/microsoft.
	basePath: withBase('/api/auth'),
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: dbDialect === 'postgresql' ? 'pg' : 'sqlite' }),
	emailAndPassword: { enabled: passwordLogin },
	socialProviders: microsoftLogin
		? {
				microsoft: {
					...microsoftLogin,
					// Always asks which account, so a shared computer doesn't log the wrong person in.
					prompt: 'select_account',
					// Would be fetched from Graph and stored in the user row on every login.
					disableProfilePhoto: true
				}
			}
		: undefined,
	account: {
		accountLinking: {
			// Someone who had an account with a password logs in with Microsoft
			// under the same address: the same account, not a second one. The
			// tenant controls those addresses.
			enabled: true,
			trustedProviders: ['microsoft']
		}
	},
	// The JWT plugin's own /token endpoint isn't needed: access tokens come
	// from the OAuth provider's /oauth2/token.
	disabledPaths: ['/token'],
	user: {
		additionalFields: {
			// 'admin' may edit everything and manage groups and access rules
			// ($lib/access.ts); everyone else is a 'member'.
			role: { type: 'string', defaultValue: 'member', input: false }
		}
	},
	databaseHooks: {
		user: {
			create: {
				// Enforced here rather than in the login form, so the public
				// /api/auth/sign-up endpoint is covered as well.
				before: async (user, context) => {
					// Microsoft logins come from the company's own tenant: everyone
					// there may have an account, whatever ALLOW_SIGNUP says.
					const viaMicrosoft = !!microsoftLogin && context?.params?.id === 'microsoft';
					if (!viaMicrosoft && !(await isSignupAllowed())) {
						throw new APIError('FORBIDDEN', { message: 'Die Registrierung ist deaktiviert.' });
					}
					// The first account sets the wiki up, so it administers it.
					if (!(await hasUsers())) return { data: { ...user, role: 'admin' } };
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
						loginPage: withBase('/login'),
						consentPage: withBase('/consent'),
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

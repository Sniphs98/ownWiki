import { env } from '$env/dynamic/private';
import { betterAuth } from 'better-auth/minimal';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db, dbDialect } from '$lib/server/db';
import { isSignupAllowed } from '$lib/server/signup';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: dbDialect === 'postgresql' ? 'pg' : 'sqlite' }),
	emailAndPassword: { enabled: true },
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
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});

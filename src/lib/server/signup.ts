import { env } from '$env/dynamic/private';
import { db, dbDialect } from '$lib/server/db';

/**
 * Who may create an account (ALLOW_SIGNUP):
 * - `true` — anyone.
 * - `false` — nobody.
 * - unset (default) — only the very first account, so a fresh install can
 *   be set up without leaving registration open to everyone afterwards.
 */
export type SignupPolicy = 'open' | 'closed' | 'first-user';

export function parseSignupPolicy(value: string | undefined): SignupPolicy {
	if (value === 'true') return 'open';
	if (value === 'false') return 'closed';
	return 'first-user';
}

export const signupPolicy = parseSignupPolicy(env.ALLOW_SIGNUP);

const schema =
	dbDialect === 'postgresql'
		? await import('$lib/server/db/schema/pg')
		: await import('$lib/server/db/schema/sqlite');

async function hasUsers(): Promise<boolean> {
	return (await db.$count(schema.user)) > 0;
}

export async function isSignupAllowed(): Promise<boolean> {
	if (signupPolicy === 'open') return true;
	if (signupPolicy === 'closed') return false;
	return !(await hasUsers());
}

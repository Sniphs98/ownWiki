import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { auth } from '$lib/server/auth';
import { withBase } from '$lib/base-path';

/** What the OAuth provider adds to sign the query it hands to /login and /consent. */
const SIGNING_PARAMS = ['sig', 'exp', 'ba_iat', 'ba_pl', 'ba_param'];

/**
 * The signed authorization request an AI assistant's login brought to this
 * page (the provider sends people to /login and /consent with it), or null
 * if the page wasn't reached that way or the signature doesn't hold.
 */
export async function signedOAuthQuery(url: URL): Promise<string | null> {
	if (!url.searchParams.has('sig')) return null;
	// Without a form action's name (`?/signIn&…`), which isn't part of it.
	const params = new URLSearchParams(url.search);
	for (const name of [...params.keys()]) if (name.startsWith('/')) params.delete(name);
	const query = params.toString();
	const { secret } = await auth.$context;
	return (await verifyOAuthQueryParams(query, secret)) ? query : null;
}

/**
 * After logging in during an assistant's authorization: the address that
 * takes the authorization up again, now with a session — on to the consent
 * page. The authorize endpoint checks the request again, so this can only
 * ever lead to a registered client's redirect address.
 */
export async function oauthContinuation(url: URL): Promise<string | null> {
	const query = await signedOAuthQuery(url);
	if (!query) return null;
	const params = new URLSearchParams(query);
	for (const name of SIGNING_PARAMS) params.delete(name);
	return withBase(`/api/auth/oauth2/authorize?${params}`);
}

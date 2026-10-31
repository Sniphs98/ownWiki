import { error, redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { signedOAuthQuery } from '$lib/server/oauth-flow';
import type { Actions, PageServerLoad } from './$types';
import { withBase } from '$lib/base-path';

/**
 * Where an AI assistant's authorization asks the person whether it may act
 * on their behalf. The OAuth provider (mcp() in auth.ts) sends them here,
 * logged in, with the signed authorization request in the query.
 */
export const load: PageServerLoad = async (event) => {
	const query = await signedOAuthQuery(event.url);
	if (!query)
		error(400, 'Die Anfrage ist ungültig oder abgelaufen. Bitte starte die Verbindung neu.');
	if (!event.locals.user) redirect(303, withBase(`/login${event.url.search}`));

	const clientId = new URLSearchParams(query).get('client_id') ?? '';
	const client = await auth.api
		.getOAuthClientPublic({ query: { client_id: clientId }, headers: event.request.headers })
		.catch(() => null);

	return {
		oauthQuery: query,
		clientName: client?.client_name || 'Eine Anwendung',
		userName: event.locals.user.name
	};
};

async function answer(event: Parameters<Actions[string]>[0], accept: boolean) {
	const formData = await event.request.formData();
	const oauthQuery = formData.get('oauth_query')?.toString() ?? '';

	// As a real request through Better Auth's handler rather than auth.api:
	// the consent endpoint finishes the authorization itself, and that needs
	// the request.
	const response = await auth.handler(
		new Request(new URL(withBase('/api/auth/oauth2/consent'), event.url), {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				cookie: event.request.headers.get('cookie') ?? '',
				origin: event.url.origin
			},
			body: JSON.stringify({ accept, oauth_query: oauthQuery })
		})
	);
	const result = await response.json().catch(() => null);
	if (!response.ok || typeof result?.url !== 'string') {
		error(400, 'Die Anfrage ist ungültig oder abgelaufen. Bitte starte die Verbindung neu.');
	}
	// Back to the assistant, with an authorization code or the refusal.
	redirect(303, result.url);
}

export const actions: Actions = {
	accept: (event) => answer(event, true),
	deny: (event) => answer(event, false)
};

// A stand-in for Microsoft's login (Entra ID), for the e2e tests: the wiki
// points MICROSOFT_AUTHORITY here. Its login page just asks for an email
// and a name, and the token it hands back carries what Entra ID's does
// (oid, tid, email, name) — so the whole round trip runs, without
// Microsoft.
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT);
const authority = `http://localhost:${PORT}`;

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const escape = (text) =>
	String(text).replace(
		/[&<>"]/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
	);

async function form(request) {
	let body = '';
	for await (const chunk of request) body += chunk;
	return new URLSearchParams(body);
}

function back(response, redirectUri, params) {
	const target = new URL(redirectUri);
	for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
	response.writeHead(302, { location: target.href }).end();
}

createServer(async (request, response) => {
	const url = new URL(request.url, authority);
	const [, tenant, ...rest] = url.pathname.split('/');
	const route = rest.join('/');

	if (request.method === 'GET' && route === 'oauth2/v2.0/authorize') {
		const hidden = ['redirect_uri', 'state', 'client_id']
			.map(
				(name) =>
					`<input type="hidden" name="${name}" value="${escape(url.searchParams.get(name) ?? '')}">`
			)
			.join('');
		response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
		response.end(`<!doctype html><title>Microsoft (Test)</title>
			<form method="post" action="/${tenant}/login">${hidden}
				<label>E-Mail <input name="email"></label>
				<label>Name <input name="name"></label>
				<button name="choice" value="login">Weiter</button>
				<button name="choice" value="cancel">Abbrechen</button>
			</form>`);
		return;
	}

	if (request.method === 'POST' && route === 'login') {
		const fields = await form(request);
		const redirectUri = fields.get('redirect_uri');
		const state = fields.get('state');
		if (fields.get('choice') === 'cancel') {
			back(response, redirectUri, { error: 'access_denied', state });
			return;
		}
		const person = { email: fields.get('email'), name: fields.get('name') };
		back(response, redirectUri, { code: base64url(person), state });
		return;
	}

	if (request.method === 'POST' && route === 'oauth2/v2.0/token') {
		const fields = await form(request);
		const { email, name } = JSON.parse(Buffer.from(fields.get('code'), 'base64url').toString());
		const now = Math.floor(Date.now() / 1000);
		const claims = {
			oid: `oid-${email}`,
			sub: `sub-${email}`,
			tid: tenant,
			iss: `${authority}/${tenant}/v2.0`,
			aud: fields.get('client_id'),
			email,
			preferred_username: email,
			name,
			iat: now,
			exp: now + 3600
		};
		response.writeHead(200, { 'content-type': 'application/json' });
		response.end(
			JSON.stringify({
				token_type: 'Bearer',
				expires_in: 3600,
				access_token: 'fake-access-token',
				id_token: `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(claims)}.e2e`
			})
		);
		return;
	}

	response.writeHead(404).end();
}).listen(PORT, () => console.log(`[e2e] fake Microsoft login on port ${PORT}`));

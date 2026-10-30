import { createHash, randomBytes } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { FULL_PORT } from '../playwright.config';

// The private wiki: an AI assistant gets in through OAuth, as the person
// who connected it — like ChatGPT's connectors do.
const baseURL = `http://localhost:${FULL_PORT}`;
test.use({ baseURL });

const RESOURCE = `${baseURL}/mcp`;
// The assistant's address for the authorization code; never really reached.
const REDIRECT_URI = 'http://localhost:9/callback';

async function rpc(request: APIRequestContext, method: string, params: object, token?: string) {
	return request.post('/mcp', {
		data: { jsonrpc: '2.0', id: 1, method, params },
		headers: {
			accept: 'application/json, text/event-stream',
			...(token ? { authorization: `Bearer ${token}` } : {})
		}
	});
}

/** Calls a tool and returns its JSON result. */
async function callTool(request: APIRequestContext, token: string, name: string, args: object) {
	const response = await rpc(request, 'tools/call', { name, arguments: args }, token);
	expect(response.ok()).toBe(true);
	const body = await response.json();
	return JSON.parse(body.result.content[0].text);
}

test('without an access token, /mcp says where to log in', async ({ request }) => {
	const response = await rpc(request, 'tools/list', {});
	expect(response.status()).toBe(401);
	expect(response.headers()['www-authenticate']).toContain('/.well-known/oauth-protected-resource');

	const resource = await (await request.get('/.well-known/oauth-protected-resource/mcp')).json();
	expect(resource.resource).toBe(RESOURCE);

	const [issuer] = resource.authorization_servers;
	const server = await (
		await request.get(`/.well-known/oauth-authorization-server${new URL(issuer).pathname}`)
	).json();
	expect(server.issuer).toBe(issuer);
	expect(server.registration_endpoint).toBeTruthy();

	expect((await rpc(request, 'tools/list', {}, 'kein-echtes-token')).status()).toBe(401);
});

test('an assistant connects through login and consent, then reads as that person', async ({
	page,
	playwright,
	// The assistant's server: no login cookie, like ChatGPT's.
	request
}) => {
	// Discovery and registration, as an assistant does it.
	const resource = await (await request.get('/.well-known/oauth-protected-resource/mcp')).json();
	const server = await (
		await request.get(
			`/.well-known/oauth-authorization-server${new URL(resource.authorization_servers[0]).pathname}`
		)
	).json();
	const registration = await request.post(server.registration_endpoint, {
		data: {
			client_name: 'E2E-Assistent',
			redirect_uris: [REDIRECT_URI],
			token_endpoint_auth_method: 'none',
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code']
		}
	});
	expect(registration.ok()).toBe(true);
	const { client_id: clientId } = await registration.json();

	const email = `mcp-${Date.now()}@example.test`;
	const password = 'ein-langes-passwort-123';
	const person = await playwright.request.newContext({ baseURL });
	const signUp = await person.post('/api/auth/sign-up/email', {
		data: { email, password, name: 'Erika Muster' },
		headers: { origin: baseURL }
	});
	expect(signUp.ok()).toBe(true);
	await person.dispose();

	// The person's browser: authorize → login → consent → back to the assistant.
	const verifier = randomBytes(32).toString('base64url');
	const authorize = new URL(server.authorization_endpoint);
	authorize.search = new URLSearchParams({
		response_type: 'code',
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		scope: 'openid offline_access',
		state: 'e2e-state',
		code_challenge: createHash('sha256').update(verifier).digest('base64url'),
		code_challenge_method: 'S256',
		resource: RESOURCE
	}).toString();

	await page.goto(authorize.toString());
	await expect(page).toHaveURL(/\/login\?/);
	await page.locator('#signin-email').fill(email);
	await page.locator('#signin-password').fill(password);
	await page.getByRole('button', { name: 'Anmelden', exact: true }).click();

	await expect(page).toHaveURL(/\/consent\?/);
	await expect(page.getByText('E2E-Assistent')).toBeVisible();
	await expect(page.getByText('Erika Muster')).toBeVisible();
	const [callbackRequest] = await Promise.all([
		page.waitForRequest((req) => req.url().startsWith(REDIRECT_URI)),
		page.getByRole('button', { name: 'Erlauben' }).click()
	]);
	const callback = new URL(callbackRequest.url());
	expect(callback.searchParams.get('state')).toBe('e2e-state');
	const code = callback.searchParams.get('code');
	expect(code).toBeTruthy();

	// The assistant trades the code for an access token…
	const tokenResponse = await request.post(server.token_endpoint, {
		form: {
			grant_type: 'authorization_code',
			code: code!,
			redirect_uri: REDIRECT_URI,
			client_id: clientId,
			code_verifier: verifier,
			resource: RESOURCE
		}
	});
	expect(tokenResponse.ok()).toBe(true);
	const { access_token: token } = await tokenResponse.json();

	// …and uses the wiki's tools with it.
	const tools = await rpc(request, 'tools/list', {}, token);
	expect(tools.ok()).toBe(true);
	expect((await tools.json()).result.tools.map((t: { name: string }) => t.name)).toEqual([
		'search',
		'fetch',
		'list_pages',
		'get_backlinks'
	]);

	const { results } = await callTool(request, token, 'search', { query: 'Sicherung' });
	expect(results[0]).toMatchObject({
		id: 'e2e/handbuch/betrieb',
		title: 'Betrieb',
		url: `${baseURL}/w/e2e/handbuch/betrieb`
	});

	const fetched = await callTool(request, token, 'fetch', { id: 'e2e/handbuch/betrieb' });
	expect(fetched.text).toContain('Täglich um 2 Uhr.');

	const { pages } = await callTool(request, token, 'list_pages', { prefix: 'e2e/handbuch' });
	expect(pages.map((p: { id: string }) => p.id)).toEqual([
		'e2e/handbuch',
		'e2e/handbuch/betrieb',
		'e2e/handbuch/einrichtung'
	]);
});

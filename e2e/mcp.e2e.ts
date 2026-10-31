import { createHash, randomBytes, randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { expect, test, type APIRequestContext, type Page, type Playwright } from '@playwright/test';
import { FULL_PORT } from '../playwright.config';

// The private wiki: an AI assistant gets in through OAuth, as the person
// who connected it — like ChatGPT's connectors do.
const baseURL = `http://localhost:${FULL_PORT}`;
test.use({ baseURL });

const RESOURCE = `${baseURL}/mcp`;
const DATABASE = './.data/e2e/full/wiki.db';
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

/**
 * Connects an assistant the way ChatGPT does — discovery, registration,
 * then the person's login and consent in the browser — and returns its
 * access token. `request` is the assistant's server: no login cookie.
 */
async function connectAssistant(
	{ page, playwright, request }: { page: Page; playwright: Playwright; request: APIRequestContext },
	name: string
) {
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
		data: { email, password, name },
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
	await expect(page.getByText(name)).toBeVisible();
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
	return (await tokenResponse.json()).access_token as string;
}

test('an assistant connects through login and consent, then reads as that person', async ({
	page,
	playwright,
	request
}) => {
	const token = await connectAssistant({ page, playwright, request }, 'Erika Muster');

	const tools = await rpc(request, 'tools/list', {}, token);
	expect(tools.ok()).toBe(true);
	expect((await tools.json()).result.tools.map((t: { name: string }) => t.name)).toEqual([
		'search',
		'fetch',
		'list_pages',
		'get_backlinks',
		'create_page',
		'update_page',
		'append_to_page'
	]);

	const { results } = await callTool(request, token, 'search', { query: 'Sicherung' });
	expect(results[0]).toMatchObject({
		id: 'e2e/handbuch/betrieb',
		title: 'Betrieb',
		url: `${baseURL}/w/e2e/handbuch/betrieb`
	});

	// By meaning, without a shared word (e2e/fake-embeddings.js) — once embedded.
	await expect
		.poll(
			async () =>
				(await callTool(request, token, 'search', { query: 'Datensicherung' })).results.map(
					(hit: { id: string }) => hit.id
				),
			{ timeout: 15_000 }
		)
		.toContain('e2e/handbuch/betrieb');

	const fetched = await callTool(request, token, 'fetch', { id: 'e2e/handbuch/betrieb' });
	expect(fetched.text).toContain('Täglich um 2 Uhr.');

	const { pages } = await callTool(request, token, 'list_pages', { prefix: 'e2e/handbuch' });
	expect(pages.map((p: { id: string }) => p.id)).toEqual([
		'e2e/handbuch',
		'e2e/handbuch/betrieb',
		'e2e/handbuch/einrichtung'
	]);
});

test('an assistant writes as the person, and the history says so', async ({
	page,
	playwright,
	request
}) => {
	const token = await connectAssistant({ page, playwright, request }, 'Max Notiz');
	const id = `e2e/ki-notiz-${Date.now()}`;

	const created = await callTool(request, token, 'create_page', {
		id,
		content: '# KI-Notiz\n\nErster Gedanke.\n'
	});
	expect(created).toMatchObject({ id, title: 'KI-Notiz', version: 1 });

	const appended = await callTool(request, token, 'append_to_page', {
		id,
		content: '- Zweiter Gedanke',
		change_summary: 'Gedanken ergänzt'
	});
	expect(appended.version).toBe(2);

	// Built on version 1, but version 2 is there now: refused, nothing lost.
	const stale = await rpc(
		request,
		'tools/call',
		{ name: 'update_page', arguments: { id, content: '# KI-Notiz\n\nNeu.', base_version: 1 } },
		token
	);
	const staleResult = (await stale.json()).result;
	expect(staleResult.isError).toBe(true);
	expect(staleResult.content[0].text).toContain('jetzt Version 2');

	const updated = await callTool(request, token, 'update_page', {
		id,
		content: '# Gedanken\n\nErster Gedanke.\n\n- Zweiter Gedanke\n',
		base_version: 2
	});
	expect(updated).toMatchObject({ title: 'Gedanken', version: 3 });

	const duplicate = await rpc(
		request,
		'tools/call',
		{ name: 'create_page', arguments: { id, content: '# Nochmal' } },
		token
	);
	expect((await duplicate.json()).result.isError).toBe(true);

	await page.goto(`/w/${id}/history`);
	await expect(page.getByText('Max Notiz über E2E-Assistent')).toHaveCount(3);
	await expect(page.getByText('Gedanken ergänzt')).toBeVisible();
});

test('an assistant may do no more than the person who connected it', async ({
	page,
	playwright,
	request
}) => {
	const name = `Lea ${Date.now().toString(36)}`;
	const token = await connectAssistant({ page, playwright, request }, name);
	const area = `e2e/ki-zugriff-${Date.now().toString(36)}`;
	await callTool(request, token, 'create_page', { id: `${area}/offen`, content: '# Offen' });
	await callTool(request, token, 'create_page', { id: `${area}/zu`, content: '# Zu' });

	// As an admin would set it on /verwaltung: Lea may only read "offen", not see "zu".
	const db = new Database(DATABASE);
	try {
		const { id: userId } = db.prepare('SELECT id FROM user WHERE name = ?').get(name) as {
			id: string;
		};
		const rule = db.prepare(
			`INSERT INTO access_rule (id, path, subject_type, subject_id, level) VALUES (?, ?, 'user', ?, ?)`
		);
		rule.run(randomUUID(), `${area}/offen`, userId, 'read');
		rule.run(randomUUID(), `${area}/zu`, userId, 'none');
	} finally {
		db.close();
	}

	const call = async (name: string, args: object) =>
		(await (await rpc(request, 'tools/call', { name, arguments: args }, token)).json()).result;

	const { pages } = await callTool(request, token, 'list_pages', { prefix: area });
	expect(pages.map((p: { id: string }) => p.id)).toEqual([`${area}/offen`]);
	expect((await call('fetch', { id: `${area}/zu` })).isError).toBe(true);
	expect((await call('fetch', { id: `${area}/offen` })).isError).toBeUndefined();

	const append = await call('append_to_page', { id: `${area}/offen`, content: 'Mehr' });
	expect(append.isError).toBe(true);
	expect(append.content[0].text).toContain('nicht bearbeiten');
	expect((await call('create_page', { id: `${area}/zu/neu`, content: '# Neu' })).isError).toBe(
		true
	);
});

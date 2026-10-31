import Database from 'better-sqlite3';
import { expect, test } from '@playwright/test';
import { BASE_PATH_PORT } from '../playwright.config';

// The wiki under a path, as behind a reverse proxy: BASE_PATH=/wiki,
// written into the build when the server starts (scripts/start.js).
const origin = `http://localhost:${BASE_PATH_PORT}`;
const baseURL = `${origin}/wiki/`;
test.use({ baseURL });
const DATABASE = './.data/e2e/base-path/wiki.db';

/** What's stored for a page: its links without the base path. */
function storedContent(path: string) {
	const db = new Database(DATABASE, { readonly: true });
	try {
		const row = db
			.prepare(
				`SELECT v.content FROM page p JOIN page_version v ON v.page_id = p.id
				 WHERE p.path = ? ORDER BY v.version_number DESC LIMIT 1`
			)
			.get(path) as { content: string };
		return row.content;
	} finally {
		db.close();
	}
}

test('everything is under the path, nothing at the root', async ({ page, request }) => {
	expect((await request.get(`${origin}/`)).status()).toBe(404);
	expect((await request.get(`${origin}/w/e2e/handbuch`)).status()).toBe(404);

	await page.goto('w/e2e/handbuch/betrieb');
	await expect(page.getByRole('heading', { name: 'Betrieb', level: 1 })).toBeVisible();

	// Breadcrumb, sidebar and search lead to /wiki/….
	await page
		.getByRole('navigation', { name: 'breadcrumb' })
		.getByRole('link', { name: 'handbuch' })
		.click();
	await expect(page).toHaveURL(`${baseURL}w/e2e/handbuch`);
	await page.getByRole('searchbox', { name: 'Wiki durchsuchen' }).fill('Sicherung');
	await page.getByRole('searchbox', { name: 'Wiki durchsuchen' }).press('Enter');
	await expect(page).toHaveURL(new RegExp(`^${baseURL}suche\\?q=Sicherung`));
	await page
		.getByRole('link', { name: /Betrieb/ })
		.first()
		.click();
	await expect(page).toHaveURL(`${baseURL}w/e2e/handbuch/betrieb`);
});

test('links and files in a page work under the path, and are stored without it', async ({
	page,
	request
}) => {
	const id = Date.now().toString(36);
	const path = `e2e/pfad-${id}`;

	const upload = await request.post('api/files', {
		multipart: {
			file: {
				name: 'punkt.svg',
				mimeType: 'image/svg+xml',
				buffer: Buffer.from(
					'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'
				)
			},
			pageId: 'unbekannt'
		},
		headers: { origin }
	});
	// Files belong to a saved page: the upload needs one first.
	expect(upload.status()).toBe(400);

	const saved = await request.post(`w/${path}/edit?/save`, {
		form: { content: `# Pfad ${id}\n\nSiehe [[Betrieb]] und [Handbuch](/w/e2e/handbuch).` },
		headers: { origin, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(saved.status()).toBe(303);
	expect(saved.headers().location).toBe(`/wiki/w/${path}`);

	await page.goto(`w/${path}`);
	const main = page.getByRole('main');
	await expect(main.getByRole('link', { name: 'Betrieb' })).toHaveAttribute(
		'href',
		'/wiki/w/e2e/handbuch/betrieb'
	);
	await expect(main.getByRole('link', { name: 'Handbuch' })).toHaveAttribute(
		'href',
		'/wiki/w/e2e/handbuch'
	);

	// Saved again from the editor, which shows the links with /wiki: stored without.
	await page.goto(`w/${path}/edit`);
	await expect(page.locator('.milkdown')).toContainText('Siehe');
	await page.getByRole('button', { name: 'Speichern', exact: true }).click();
	await expect(page).toHaveURL(`${baseURL}w/${path}`);
	expect(storedContent(path)).toContain('[Handbuch](/w/e2e/handbuch)');
	expect(storedContent(path)).not.toContain('/wiki/');
});

test('logging in comes back to the page under the path', async ({ page }) => {
	const email = `pfad-${Date.now().toString(36)}@example.test`;
	const signUp = await page.request.post('api/auth/sign-up/email', {
		data: { email, password: 'ein-langes-passwort-123', name: 'Paula Pfad' },
		headers: { origin }
	});
	expect(signUp.ok()).toBe(true);
	await page.context().clearCookies();

	await page.goto(`login?redirectTo=${encodeURIComponent('/wiki/w/e2e/handbuch')}`);
	await page.locator('#signin-email').fill(email);
	await page.locator('#signin-password').fill('ein-langes-passwort-123');
	await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
	await expect(page).toHaveURL(`${baseURL}w/e2e/handbuch`);
	await expect(page.getByRole('link', { name: 'Anmelden' })).toHaveCount(0);
});

test('the PDF export renders under the path', async ({ request }) => {
	const response = await request.get('api/pdf/e2e/handbuch');
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toBe('application/pdf');
});

test('AI assistants find the MCP endpoint and its login under the path', async ({ request }) => {
	const response = await request.post('mcp', {
		data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
		headers: { accept: 'application/json, text/event-stream' }
	});
	expect(response.status()).toBe(401);
	// Clients look at the domain's root, as the standard says…
	expect(response.headers()['www-authenticate']).toContain(
		`resource_metadata="${origin}/.well-known/oauth-protected-resource/wiki/mcp"`
	);

	// …and the reverse proxy passes that on with /wiki in front (README).
	const resource = await (
		await request.get('.well-known/oauth-protected-resource/wiki/mcp')
	).json();
	expect(resource.resource).toBe(`${origin}/wiki/mcp`);
	const [issuer] = resource.authorization_servers;
	expect(issuer).toBe(`${origin}/wiki/api/auth`);

	// Where to log in: at the root with the issuer's path after it, or after the issuer.
	for (const path of [
		'.well-known/oauth-authorization-server/wiki/api/auth',
		'api/auth/.well-known/oauth-authorization-server'
	]) {
		const server = await (await request.get(path)).json();
		expect(server.issuer, path).toBe(issuer);
		expect(server.authorization_endpoint).toBe(`${origin}/wiki/api/auth/oauth2/authorize`);
	}
});

test('an AI assistant connects all the way through, under the path', async ({
	page,
	playwright,
	request
}) => {
	const resource = `${origin}/wiki/mcp`;
	const redirectUri = 'http://localhost:9/callback';
	const server = await (
		await request.get('.well-known/oauth-authorization-server/wiki/api/auth')
	).json();
	const registration = await request.post(server.registration_endpoint, {
		data: {
			client_name: 'Pfad-Assistent',
			redirect_uris: [redirectUri],
			token_endpoint_auth_method: 'none',
			grant_types: ['authorization_code'],
			response_types: ['code']
		}
	});
	expect(registration.ok()).toBe(true);
	const { client_id: clientId } = await registration.json();

	const email = `assistent-${Date.now().toString(36)}@example.test`;
	const person = await playwright.request.newContext({ baseURL });
	expect(
		(
			await person.post('api/auth/sign-up/email', {
				data: { email, password: 'ein-langes-passwort-123', name: 'Ada Assistent' },
				headers: { origin }
			})
		).ok()
	).toBe(true);
	await person.dispose();

	const verifier = 'pfad-verifier-0123456789012345678901234567890123';
	const { createHash } = await import('node:crypto');
	const authorize = new URL(server.authorization_endpoint);
	authorize.search = new URLSearchParams({
		response_type: 'code',
		client_id: clientId,
		redirect_uri: redirectUri,
		scope: 'openid',
		state: 'pfad',
		code_challenge: createHash('sha256').update(verifier).digest('base64url'),
		code_challenge_method: 'S256',
		resource
	}).toString();

	await page.goto(authorize.toString());
	await expect(page).toHaveURL(new RegExp(`^${baseURL}login\\?`));
	await page.locator('#signin-email').fill(email);
	await page.locator('#signin-password').fill('ein-langes-passwort-123');
	await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`^${baseURL}consent\\?`));
	const [callback] = await Promise.all([
		page.waitForRequest((req) => req.url().startsWith(redirectUri)),
		page.getByRole('button', { name: 'Erlauben' }).click()
	]);
	const code = new URL(callback.url()).searchParams.get('code')!;

	const token = await request.post(server.token_endpoint, {
		form: {
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri,
			client_id: clientId,
			code_verifier: verifier,
			resource
		}
	});
	expect(token.ok()).toBe(true);
	const { access_token: accessToken } = await token.json();

	const tools = await request.post('mcp', {
		data: {
			jsonrpc: '2.0',
			id: 1,
			method: 'tools/call',
			params: { name: 'fetch', arguments: { id: 'e2e/handbuch/betrieb' } }
		},
		headers: {
			accept: 'application/json, text/event-stream',
			authorization: `Bearer ${accessToken}`
		}
	});
	expect(tools.ok()).toBe(true);
	const fetched = JSON.parse((await tools.json()).result.content[0].text);
	expect(fetched.url).toBe(`${origin}/wiki/w/e2e/handbuch/betrieb`);
});

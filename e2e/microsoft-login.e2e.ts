import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { expect, test, type Page } from '@playwright/test';
import { FAKE_MICROSOFT_PORT, MICROSOFT_PORT } from '../playwright.config';

// A private wiki that logs in with Microsoft — e2e/fake-microsoft.js stands
// in for Entra ID — with registration closed (ALLOW_SIGNUP=false).
const baseURL = `http://localhost:${MICROSOFT_PORT}`;
test.use({ baseURL });
const DATABASE = './.data/e2e/microsoft/wiki.db';

const unique = (name: string) =>
	`${name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@firma.test`;

/** Through Microsoft's login page, as this person; ends back at the wiki. */
async function loginWithMicrosoft(page: Page, email: string, name: string) {
	await page.getByRole('button', { name: 'Mit Microsoft anmelden' }).click();
	await expect(page).toHaveURL(
		new RegExp(`^http://localhost:${FAKE_MICROSOFT_PORT}/e2e-tenant/oauth2/v2.0/authorize`)
	);
	// For this wiki, in the configured tenant, always asking which account.
	const authorize = new URL(page.url());
	expect(authorize.searchParams.get('client_id')).toBe('e2e-client');
	expect(authorize.searchParams.get('prompt')).toBe('select_account');
	expect(authorize.searchParams.get('redirect_uri')).toBe(`${baseURL}/api/auth/callback/microsoft`);
	await page.getByLabel('E-Mail').fill(email);
	await page.getByLabel('Name').fill(name);
	await page.getByRole('button', { name: 'Weiter' }).click();
}

function accountsOf(email: string) {
	const db = new Database(DATABASE, { readonly: true });
	try {
		return db
			.prepare(
				`SELECT u.id, u.role, a.provider_id AS provider FROM user u
				 LEFT JOIN account a ON a.user_id = u.id WHERE u.email = ?`
			)
			.all(email) as { id: string; role: string; provider: string | null }[];
	} finally {
		db.close();
	}
}

test('a colleague logs in with Microsoft and lands where they wanted to go', async ({ page }) => {
	const email = unique('erika');
	await page.goto('/w/e2e/handbuch');
	await expect(page).toHaveURL(/\/login\?redirectTo=/);
	// Registration is closed: only Microsoft brings new people in.
	await expect(page.getByRole('tab', { name: 'Registrieren' })).toHaveCount(0);

	await loginWithMicrosoft(page, email, 'Erika Firma');
	await expect(page).toHaveURL(`${baseURL}/w/e2e/handbuch`);
	await expect(page.getByRole('heading', { name: 'Handbuch', level: 1 })).toBeVisible();

	expect(accountsOf(email)).toEqual([expect.objectContaining({ provider: 'microsoft' })]);
});

test('registering with a password stays closed', async ({ request }) => {
	const response = await request.post('/api/auth/sign-up/email', {
		data: { email: unique('niemand'), password: 'ein-langes-passwort-123', name: 'Niemand' },
		headers: { origin: baseURL }
	});
	expect(response.ok()).toBe(false);
});

test('connecting an AI assistant works through Microsoft too', async ({ page, request }) => {
	const registration = await request.post('/api/auth/oauth2/register', {
		data: {
			client_name: 'E2E-Assistent',
			redirect_uris: ['http://localhost:9/callback'],
			token_endpoint_auth_method: 'none',
			grant_types: ['authorization_code'],
			response_types: ['code']
		}
	});
	expect(registration.ok()).toBe(true);
	const { client_id: clientId } = await registration.json();

	const authorize = new URL('/api/auth/oauth2/authorize', baseURL);
	authorize.search = new URLSearchParams({
		response_type: 'code',
		client_id: clientId,
		redirect_uri: 'http://localhost:9/callback',
		scope: 'openid',
		state: 'e2e',
		code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
		code_challenge_method: 'S256',
		resource: `${baseURL}/mcp`
	}).toString();
	await page.goto(authorize.toString());
	await expect(page).toHaveURL(/\/login\?/);

	await loginWithMicrosoft(page, unique('ina'), 'Ina Assistent');
	// Back into the authorization: the person is asked to allow the assistant.
	await expect(page).toHaveURL(/\/consent\?/);
	await expect(page.getByText('E2E-Assistent')).toBeVisible();
});

test('an existing account with the same address is used, not a second one', async ({ page }) => {
	const email = unique('max');
	const userId = randomUUID();
	const db = new Database(DATABASE);
	try {
		const now = Date.now();
		db.prepare(
			`INSERT INTO user (id, name, email, email_verified, role, created_at, updated_at)
			 VALUES (?, 'Max Bestand', ?, 1, 'admin', ?, ?)`
		).run(userId, email, now, now);
	} finally {
		db.close();
	}

	await page.goto('/login');
	await loginWithMicrosoft(page, email, 'Max über Microsoft');
	await expect(page).toHaveURL(`${baseURL}/`);

	// Same person — still an admin — now with Microsoft as a way in.
	expect(accountsOf(email)).toEqual([{ id: userId, role: 'admin', provider: 'microsoft' }]);
	await expect(page.getByRole('link', { name: 'Verwaltung' })).toBeVisible();
});

test('cancelling at Microsoft comes back with a message', async ({ page }) => {
	await page.goto('/login');
	await page.getByRole('button', { name: 'Mit Microsoft anmelden' }).click();
	await page.getByRole('button', { name: 'Abbrechen' }).click();
	await expect(page).toHaveURL(/\/login/);
	await expect(page.getByText('Die Anmeldung bei Microsoft wurde abgebrochen.')).toBeVisible();
});

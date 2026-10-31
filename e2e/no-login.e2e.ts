import { expect, test } from '@playwright/test';
import { NO_LOGIN_PORT } from '../playwright.config';

// An open wiki without any login: AUTH_MODE=disabled, PASSWORD_LOGIN=false
// and no Microsoft. Everyone edits; there are no accounts to log into.
const baseURL = `http://localhost:${NO_LOGIN_PORT}`;
test.use({ baseURL });

test('there is no way to log in, and editing works without one', async ({ page, request }) => {
	await page.goto('/w/e2e/handbuch');
	await expect(page.getByRole('heading', { name: 'Handbuch', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Anmelden' })).toHaveCount(0);
	await expect(
		page.getByRole('main').getByRole('link', { name: 'Bearbeiten' }).first()
	).toBeVisible();

	await page.goto('/login');
	await expect(page).toHaveURL(`${baseURL}/`);

	const path = `e2e/ohne-login-${Date.now().toString(36)}`;
	const saved = await request.post(`/w/${path}/edit?/save`, {
		form: { content: '# Ohne Login\n\nGeht.' },
		headers: { origin: baseURL, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(saved.status()).toBe(303);
});

test('nor can accounts be made or used, and there is no AI connection', async ({ request }) => {
	const headers = { origin: baseURL };
	const signUp = await request.post('/api/auth/sign-up/email', {
		data: { email: 'jemand@example.test', password: 'ein-langes-passwort-123', name: 'Jemand' },
		headers
	});
	expect(signUp.ok()).toBe(false);
	const signIn = await request.post('/api/auth/sign-in/email', {
		data: { email: 'jemand@example.test', password: 'ein-langes-passwort-123' },
		headers
	});
	expect(signIn.ok()).toBe(false);

	// An assistant acts as a person; without logins, there's nobody to act as.
	const mcp = await request.post('/mcp', {
		data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
		headers: { accept: 'application/json, text/event-stream' }
	});
	expect(mcp.status()).toBe(404);
});

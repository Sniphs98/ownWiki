import { expect, test, type APIRequestContext } from '@playwright/test';
import { FULL_PORT, READ_ONLY_PORT } from '../playwright.config';

// Pages seeded by e2e/setup-db.js — each server has its own database.
const PAGE = 'e2e/handbuch';

async function signUp(request: APIRequestContext, baseURL: string) {
	const response = await request.post('/api/auth/sign-up/email', {
		data: {
			email: `auth-${Date.now()}-${Math.random()}@example.test`,
			password: 'ein-langes-passwort-123',
			name: 'Auth Test'
		},
		headers: { origin: baseURL }
	});
	expect(response.ok()).toBe(true);
}

test.describe('AUTH_MODE=read-only', () => {
	const baseURL = `http://localhost:${READ_ONLY_PORT}`;
	test.use({ baseURL });

	test('anyone can read, the editor asks to log in first', async ({ page }) => {
		await page.goto(`/w/${PAGE}`);
		await expect(page.getByRole('heading', { level: 1, name: 'Handbuch' })).toBeVisible();

		await page.goto(`/w/${PAGE}/edit`);
		await expect(page).toHaveURL(`/login?redirectTo=${encodeURIComponent(`/w/${PAGE}/edit`)}`);
	});

	test('without login, nothing can be changed', async ({ request }) => {
		const headers = { origin: baseURL };
		const attempts = [
			request.post(`/w/${PAGE}/edit?/save`, {
				form: { title: 'Übernommen', content: 'Weg damit', baseVersion: '1' },
				headers
			}),
			request.post(`/w/${PAGE}/edit?/delete`, { headers }),
			request.post(`/w/${PAGE}/history?/restore`, { form: { versionNumber: '1' }, headers }),
			request.post('/api/files', {
				multipart: {
					file: { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('a') },
					pageId: 'x'
				},
				headers
			}),
			request.delete('/api/files/00000000-0000-0000-0000-000000000000', { headers }),
			request.put(`/api/cover/${PAGE}`, { data: { content: '# Titel' }, headers }),
			request.put('/api/preferences', { data: { toolbar: [] }, headers })
		];
		for (const response of await Promise.all(attempts)) {
			expect(response.status(), response.url()).toBe(401);
		}

		const page = await request.get(`/w/${PAGE}`);
		expect(await page.text()).toContain('Überblick über die folgenden Seiten.');
	});

	test('a form sent from a browser without login leads to the login page', async ({ request }) => {
		const response = await request.post(`/w/${PAGE}/edit?/save`, {
			form: { title: 'Übernommen', content: 'Weg damit' },
			headers: { origin: baseURL, accept: 'text/html' },
			maxRedirects: 0
		});
		expect(response.status()).toBe(303);
		expect(response.headers().location).toMatch(/^\/login\?redirectTo=/);
	});

	test('logged in, pages can be edited', async ({ page }) => {
		await signUp(page.request, baseURL);
		await page.goto(`/w/${PAGE}/edit`, { waitUntil: 'networkidle' });
		await expect(page).toHaveURL(`/w/${PAGE}/edit`);
		await page.getByLabel('Titel').fill('Handbuch (bearbeitet)');
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await page.waitForURL(`**/w/${PAGE}`);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Handbuch (bearbeitet)');
	});

	test('after logging in, only paths on this wiki are followed', async ({ page }) => {
		await signUp(page.request, baseURL);
		for (const target of ['//evil.example/', '/\\evil.example/', 'https://evil.example/']) {
			await page.goto(`/login?redirectTo=${encodeURIComponent(target)}`);
			await expect(page).toHaveURL(`${baseURL}/`);
		}
		await page.goto(`/login?redirectTo=${encodeURIComponent(`/w/${PAGE}`)}`);
		await expect(page).toHaveURL(`${baseURL}/w/${PAGE}`);
	});
});

test.describe('AUTH_MODE=full', () => {
	const baseURL = `http://localhost:${FULL_PORT}`;
	test.use({ baseURL });

	test('without login there is nothing to see', async ({ page, request }) => {
		await page.goto(`/w/${PAGE}`);
		await expect(page).toHaveURL(`/login?redirectTo=${encodeURIComponent(`/w/${PAGE}`)}`);

		for (const path of [`/w/${PAGE}`, `/print/${PAGE}`, `/api/pdf/${PAGE}`, '/suche?q=Handbuch']) {
			const response = await request.get(path, { maxRedirects: 0 });
			expect(response.status(), path).toBe(401);
		}
	});

	test('logged in, the PDF export still reaches the print view', async ({ request }) => {
		await signUp(request, baseURL);
		const response = await request.get(`/api/pdf/${PAGE}`);
		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toBe('application/pdf');
	});
});

import { expect, test, type Page } from '@playwright/test';
import { FULL_PORT, READ_ONLY_PORT } from '../playwright.config';

// The full server has an embeddings service (e2e/fake-embeddings.js, which
// knows that "Datensicherung" and "Sicherung" mean the same); the
// read-only server has one configured that can't be reached.

async function signUp(page: Page, baseURL: string) {
	const response = await page.request.post('/api/auth/sign-up/email', {
		data: {
			email: `semantik-${Date.now()}-${Math.random()}@example.test`,
			password: 'ein-langes-passwort-123',
			name: 'Semantik Test'
		},
		headers: { origin: baseURL }
	});
	expect(response.ok()).toBe(true);
}

/** Searches until `title` turns up: pages are embedded in the background. */
async function searchUntilFound(page: Page, query: string, title: string) {
	const hit = page.locator('ol li a', { hasText: title });
	await expect(async () => {
		await page.goto(`/suche?q=${encodeURIComponent(query)}`);
		await expect(hit).toBeVisible({ timeout: 500 });
	}).toPass({ timeout: 15_000 });
	return hit;
}

test.describe('with an embeddings service', () => {
	const baseURL = `http://localhost:${FULL_PORT}`;
	test.use({ baseURL });

	test('finds pages by meaning, without a shared word', async ({ page }) => {
		await signUp(page, baseURL);

		// "Datensicherung" isn't on any page; "Betrieb" has a section "Sicherung".
		const hit = await searchUntilFound(page, 'Datensicherung', 'Betrieb');
		await expect(hit.getByText('inhaltlich ähnlich')).toBeVisible();
		await expect(hit).toContainText('Täglich um 2 Uhr.');
		await expect(hit.locator('mark')).toHaveCount(0);

		// Found by its words too: the full-text hit, with the word marked.
		const byWords = await searchUntilFound(page, 'Sicherung', 'Betrieb');
		await expect(byWords.getByText('inhaltlich ähnlich')).toHaveCount(0);
		await expect(byWords.locator('mark').first()).toHaveText('Sicherung');
	});

	test('a saved page is found by meaning soon after', async ({ page }) => {
		await signUp(page, baseURL);
		const path = `e2e/semantik-${Date.now().toString(36)}`;
		const saved = await page.request.post(`/w/${path}/edit?/save`, {
			form: { content: '# Abwesenheiten\n\nDen Urlaubsantrag stellst du bis März.\n' },
			headers: { origin: baseURL, accept: 'text/html' },
			maxRedirects: 0
		});
		expect(saved.status()).toBe(303);

		const hit = await searchUntilFound(page, 'Ferien', 'Abwesenheiten');
		await expect(hit.getByText('inhaltlich ähnlich')).toBeVisible();

		// Changed, it's about something else — and no longer found that way.
		const changed = await page.request.post(`/w/${path}/edit?/save`, {
			form: {
				content: '# Abwesenheiten\n\nKrankmeldungen gehen an die Teamleitung.\n',
				baseVersion: '1'
			},
			headers: { origin: baseURL, accept: 'text/html' },
			maxRedirects: 0
		});
		expect(changed.status()).toBe(303);
		await expect(async () => {
			await page.goto('/suche?q=Ferien');
			await expect(page.locator('ol li a', { hasText: 'Abwesenheiten' })).toHaveCount(0, {
				timeout: 500
			});
		}).toPass({ timeout: 15_000 });
	});
});

test.describe('with an embeddings service that is down', () => {
	test.use({ baseURL: `http://localhost:${READ_ONLY_PORT}` });

	test('the full-text search still answers', async ({ page }) => {
		await page.goto('/suche?q=Sicherung');
		await expect(page.locator('ol li a', { hasText: 'Betrieb' })).toBeVisible();
		await expect(page.getByText('inhaltlich ähnlich')).toHaveCount(0);
	});
});

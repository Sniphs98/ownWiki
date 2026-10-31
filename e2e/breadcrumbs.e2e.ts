import { expect, test } from '@playwright/test';

// The default server, with the pages from e2e/setup-db.js: "e2e" is only a
// folder, "e2e/handbuch" is a page.

test('a folder in the breadcrumb opens a list of what is in it', async ({ page }) => {
	await page.goto('/w/e2e/handbuch/betrieb');
	const trail = page.getByRole('navigation', { name: 'breadcrumb' });

	// "e2e" has no page of its own: it's a folder.
	await trail.getByRole('link', { name: 'e2e', exact: true }).click();
	await expect(page).toHaveURL(/\/w\/e2e$/);
	await expect(page.getByRole('heading', { name: 'e2e', level: 1 })).toBeVisible();
	const contents = page.getByRole('list', { name: 'Inhalt von e2e' });
	await expect(contents.getByRole('link', { name: /Handbuch/ })).toBeVisible();

	await contents.getByRole('link', { name: /Handbuch/ }).click();
	await expect(page).toHaveURL(/\/w\/e2e\/handbuch$/);
	await expect(page.getByRole('heading', { name: 'Handbuch', level: 1 })).toBeVisible();
});

test('a path with nothing below it is still not found', async ({ request }) => {
	expect((await request.get('/w/gibt-es-nicht-und-nichts-darunter')).status()).toBe(404);
});

test('the history keeps the page as the last breadcrumb', async ({ page }) => {
	await page.goto('/w/e2e/handbuch/history');
	const trail = page.getByRole('navigation', { name: 'breadcrumb' });
	await expect(trail.locator('[aria-current="page"]')).toHaveText('handbuch');
	await expect(trail).not.toContainText('history');
});

import { expect, test } from '@playwright/test';

// The default server, with the pages from e2e/setup-db.js: "e2e" is only a
// folder, "e2e/handbuch" is a page.

test('breadcrumbs link the pages above, and show folders as plain text', async ({ page }) => {
	await page.goto('/w/e2e/handbuch/betrieb');
	const trail = page.getByRole('navigation', { name: 'breadcrumb' });

	await expect(trail).toContainText('e2e');
	await expect(trail.getByRole('link', { name: 'e2e', exact: true })).toHaveCount(0);

	await trail.getByRole('link', { name: 'handbuch' }).click();
	await expect(page).toHaveURL(/\/w\/e2e\/handbuch$/);
	await expect(page.getByRole('heading', { name: 'Handbuch', level: 1 })).toBeVisible();
});

test('the history keeps the page as the last breadcrumb', async ({ page }) => {
	await page.goto('/w/e2e/handbuch/history');
	const trail = page.getByRole('navigation', { name: 'breadcrumb' });
	await expect(trail.locator('[aria-current="page"]')).toHaveText('handbuch');
	await expect(trail).not.toContainText('history');
});

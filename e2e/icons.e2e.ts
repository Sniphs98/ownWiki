import { expect, test } from '@playwright/test';
import { BASE_PATH_PORT, FULL_PORT } from '../playwright.config';

// Once the page runs, one icon for the wiki's mode (before, one per system mode).
const tabIcon = 'link[rel="icon"][type="image/svg+xml"]:not([media])';
// The browser build has the base path as a full URL (http://…), so only the end counts.
const DARK = /\/icons\/wiki-icon\.svg$/;
const LIGHT = /\/icons\/wiki-icon-light\.svg$/;

test('the tab icon follows light and dark mode, also when chosen in the wiki', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await expect(page.locator('link[rel="icon"][media]')).toHaveCount(0);
	await expect(page.locator(tabIcon)).toHaveAttribute('href', DARK);

	await page.getByRole('button', { name: 'Design wechseln' }).click();
	await page.getByRole('menuitem', { name: 'Hell' }).click();
	await expect(page.locator(tabIcon)).toHaveAttribute('href', LIGHT);

	await page.getByRole('button', { name: 'Design wechseln' }).click();
	await page.getByRole('menuitem', { name: 'System' }).click();
	await expect(page.locator(tabIcon)).toHaveAttribute('href', DARK);
	await page.emulateMedia({ colorScheme: 'light' });
	await expect(page.locator(tabIcon)).toHaveAttribute('href', LIGHT);
});

test('the icons load without logging in, and under a base path', async ({ request }) => {
	const login = await request.get(`http://localhost:${FULL_PORT}/login`);
	expect(await login.text()).toContain('href="/icons/wiki-icon-light.svg"');
	for (const icon of ['wiki-icon.svg', 'wiki-icon-light.svg', 'wiki-icon-light-32.png']) {
		expect((await request.get(`http://localhost:${FULL_PORT}/icons/${icon}`)).ok()).toBe(true);
	}
	const underPath = await request.get(`http://localhost:${BASE_PATH_PORT}/wiki/login`);
	expect(await underPath.text()).toContain('href="/wiki/icons/wiki-icon.svg"');
	expect(
		(await request.get(`http://localhost:${BASE_PATH_PORT}/wiki/icons/wiki-icon.svg`)).ok()
	).toBe(true);
});

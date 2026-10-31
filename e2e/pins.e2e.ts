import { expect, test, type Browser } from '@playwright/test';

// The default server, with the pages from e2e/setup-db.js: "Handbuch" has
// the subpages "Betrieb" and "Einrichtung", in that order.
const baseURL = 'http://localhost:4173';

async function person(browser: Browser, name: string) {
	const context = await browser.newContext({ baseURL });
	const response = await context.request.post('/api/auth/sign-up/email', {
		data: {
			email: `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
			password: 'ein-langes-passwort-123',
			name
		},
		headers: { origin: baseURL }
	});
	expect(response.ok()).toBe(true);
	return { context, page: await context.newPage() };
}

const subpages = (page: import('@playwright/test').Page) =>
	page
		.locator('[data-sidebar="menu-sub"]')
		.filter({ has: page.getByRole('link', { name: 'Betrieb' }) })
		.last() // the innermost level: Handbuch's, not the whole e2e folder's
		.getByRole('link');

test('pinned pages move to the top of their level, for that person only', async ({ browser }) => {
	const pia = await person(browser, 'Pia');
	const otto = await person(browser, 'Otto');

	await pia.page.goto('/w/e2e/handbuch/betrieb');
	await expect(subpages(pia.page)).toHaveText(['Betrieb', 'Einrichtung']);

	await pia.page.getByRole('button', { name: 'Oben anpinnen: Einrichtung' }).click();
	await expect(subpages(pia.page)).toHaveText(['Einrichtung', 'Betrieb']);
	await expect(
		pia.page.getByRole('button', { name: 'Nicht mehr anpinnen: Einrichtung' })
	).toHaveAttribute('aria-pressed', 'true');

	// Still pinned after a reload; Otto's tree is untouched.
	await pia.page.reload();
	await expect(subpages(pia.page)).toHaveText(['Einrichtung', 'Betrieb']);
	await otto.page.goto('/w/e2e/handbuch/betrieb');
	await expect(subpages(otto.page)).toHaveText(['Betrieb', 'Einrichtung']);

	await pia.page.getByRole('button', { name: 'Nicht mehr anpinnen: Einrichtung' }).click();
	await expect(subpages(pia.page)).toHaveText(['Betrieb', 'Einrichtung']);

	await pia.context.close();
	await otto.context.close();
});

test('without a login there is nothing to pin', async ({ page }) => {
	await page.goto('/w/e2e/handbuch/betrieb');
	await expect(page.getByRole('button', { name: /anpinnen/ })).toHaveCount(0);
});

test('hovering a folder shows its own actions only, and they go away again', async ({
	browser
}) => {
	const { context, page } = await person(browser, 'Hugo');
	await page.goto('/w/e2e/handbuch/betrieb');
	const handbuchPin = page.getByRole('button', { name: 'Oben anpinnen: Handbuch' });
	const betriebPin = page.getByRole('button', { name: 'Oben anpinnen: Betrieb' });

	await page.getByRole('link', { name: 'Handbuch', exact: true }).hover();
	await expect(handbuchPin).toHaveCSS('opacity', '1');
	await expect(betriebPin).toHaveCSS('opacity', '0');

	// Clicked and left: hidden again, though it still has the focus.
	await handbuchPin.click();
	await page.getByRole('heading', { level: 1 }).first().hover();
	await expect(page.getByRole('button', { name: 'Nicht mehr anpinnen: Handbuch' })).toHaveCSS(
		'opacity',
		'1'
	); // pinned ones always show their pin
	await page.getByRole('button', { name: 'Nicht mehr anpinnen: Handbuch' }).click();
	await page.getByRole('heading', { level: 1 }).first().hover();
	await expect(handbuchPin).toHaveCSS('opacity', '0');

	await context.close();
});

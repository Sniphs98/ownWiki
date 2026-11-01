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

/** Picks an entry in the "…" menu of a tree item. */
async function fromMenu(page: import('@playwright/test').Page, title: string, item: string) {
	await page.getByRole('button', { name: `Mehr zu ${title}` }).click();
	await page.getByRole('menuitem', { name: item }).click();
}

test('pinned pages move to the top of their level, for that person only', async ({ browser }) => {
	const pia = await person(browser, 'Pia');
	const otto = await person(browser, 'Otto');

	await pia.page.goto('/w/e2e/handbuch/betrieb');
	await expect(subpages(pia.page)).toHaveText(['Betrieb', 'Einrichtung']);

	await fromMenu(pia.page, 'Einrichtung', 'Oben anpinnen');
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
	await page.getByRole('button', { name: 'Mehr zu Betrieb' }).click();
	await expect(page.getByRole('menuitem', { name: 'Link kopieren' })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: /anpinnen/ })).toHaveCount(0);
});

test('hovering an entry shows its own menu only, and it goes away again', async ({ browser }) => {
	const { context, page } = await person(browser, 'Hugo');
	await page.goto('/w/e2e/handbuch/betrieb');
	const handbuchMenu = page.getByRole('button', { name: 'Mehr zu Handbuch' });
	const betriebMenu = page.getByRole('button', { name: 'Mehr zu Betrieb' });

	await page.getByRole('link', { name: 'Handbuch', exact: true }).hover();
	await expect(handbuchMenu).toHaveCSS('opacity', '1');
	await expect(betriebMenu).toHaveCSS('opacity', '0');

	// Open while the menu is open, hidden again once it's closed and left.
	await handbuchMenu.click();
	await page.mouse.move(600, 400);
	await expect(handbuchMenu).toHaveCSS('opacity', '1');
	await page.getByRole('menuitem', { name: 'Oben anpinnen' }).click();
	await page.getByRole('heading', { level: 1 }).first().hover();
	await expect(handbuchMenu).toHaveCSS('opacity', '0');

	// A pinned one shows its pin on hover too, which unpins it.
	const pin = page.getByRole('button', { name: 'Nicht mehr anpinnen: Handbuch' });
	await expect(pin).toHaveCSS('opacity', '0');
	await page.getByRole('link', { name: 'Handbuch', exact: true }).hover();
	await expect(pin).toHaveCSS('opacity', '1');
	await pin.click();
	await expect(pin).toHaveCount(0);

	await context.close();
});

import Database from 'better-sqlite3';
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

// The default server (AUTH_MODE=disabled): visitors may edit. Each tree
// entry has a "…" menu with what can be done to that page or folder.
const baseURL = 'http://localhost:4173';
const DATABASE = './.data/e2e/disabled/wiki.db';

async function save(request: APIRequestContext, path: string, content: string) {
	const response = await request.post(`/w/${path}/edit?/save`, {
		form: { content },
		headers: { origin: baseURL, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
}

/** Opens the menu of a tree entry — again until it opens, as clicks before hydration do nothing. */
async function openMenu(page: Page, title: string) {
	const menu = page.getByRole('menu');
	await expect(async () => {
		await page.getByRole('link', { name: title, exact: true }).hover();
		await page.getByRole('button', { name: `Mehr zu ${title}` }).click();
		await expect(menu).toBeVisible({ timeout: 1_000 });
	}).toPass();
	return menu;
}

async function admin(browser: Browser) {
	const email = `ada-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`;
	const context = await browser.newContext({ baseURL });
	const response = await context.request.post('/api/auth/sign-up/email', {
		data: { email, password: 'ein-langes-passwort-123', name: 'Ada' },
		headers: { origin: baseURL }
	});
	expect(response.ok()).toBe(true);
	const db = new Database(DATABASE);
	try {
		db.prepare(`UPDATE user SET role = 'admin' WHERE email = ?`).run(email);
	} finally {
		db.close();
	}
	return { context, page: await context.newPage() };
}

test.use({ baseURL });

test('a page is moved from its menu in the tree', async ({ page, request }) => {
	const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	const area = `e2e/baummenue-${id}`;
	await save(request, `${area}/seite`, `# Baumseite ${id}\n\nInhalt.`);

	await page.goto(`/w/${area}/seite`);
	const menu = await openMenu(page, `Baumseite ${id}`);
	await menu.getByRole('menuitem', { name: 'Verschieben' }).click();
	const dialog = page.getByRole('dialog');
	await dialog.getByLabel('Name in der Adresse').fill('umbenannt');
	await expect(dialog).toContainText(`Neue Adresse: /w/${area}/umbenannt`);
	await dialog.getByRole('button', { name: 'Verschieben' }).click();
	await expect(page).toHaveURL(new RegExp(`/w/${area}/umbenannt$`));
});

test('only admins set rights from the tree, for the entry and all below it', async ({
	browser,
	page,
	request
}) => {
	const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
	const area = `e2e/baumrechte-${id}`;
	await save(request, `${area}/geheim`, `# Geheim ${id}\n\nNur für wenige.`);

	// Without being an admin, there's no rights entry.
	await page.goto(`/w/${area}/geheim`);
	await expect((await openMenu(page, `Geheim ${id}`)).getByRole('menuitem')).not.toHaveCount(0);
	await expect(page.getByRole('menuitem', { name: /Rechte/ })).toHaveCount(0);

	const ada = await admin(browser);
	await ada.page.goto(`/w/${area}/geheim`);
	const menu = await openMenu(ada.page, `Geheim ${id}`);
	await menu.getByRole('menuitem', { name: /Rechte/ }).click();
	const dialog = ada.page.getByRole('dialog', { name: `Rechte für „Geheim ${id}“` });
	await expect(dialog).toContainText('Keine eigenen Regeln.');

	await dialog.getByRole('combobox', { name: 'Recht' }).click();
	await ada.page.getByRole('option', { name: 'Kein Zugriff', exact: true }).click();
	await dialog.getByRole('button', { name: 'Regel setzen' }).click();
	await expect(dialog.getByRole('listitem')).toHaveText(['Alle: Kein Zugriff']);

	// Closed to everyone: visitors without login don't see it any more.
	expect((await request.get(`/w/${area}/geheim`)).status()).toBe(404);

	await dialog.getByRole('button', { name: 'Regel entfernen: Alle' }).click();
	await expect(dialog).toContainText('Keine eigenen Regeln.');
	expect((await request.get(`/w/${area}/geheim`)).status()).toBe(200);
	await ada.context.close();
});

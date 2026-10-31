import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// The default server (AUTH_MODE=disabled): visitors may edit, and count as
// "everyone" for access rules.
const DATABASE = './.data/e2e/disabled/wiki.db';

async function save(request: APIRequestContext, baseURL: string, path: string, content: string) {
	const response = await request.post(`/w/${path}/edit?/save`, {
		form: { content },
		headers: { origin: baseURL, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
}

async function openMoveDialog(page: Page, path: string) {
	await page.goto(`/w/${path}`);
	const dialog = page.getByRole('dialog');
	// Clicked before the page has hydrated, the button does nothing yet: again until it opens.
	await expect(async () => {
		await page.getByRole('main').getByRole('button', { name: 'Verschieben' }).first().click();
		await expect(dialog).toBeVisible({ timeout: 1_000 });
	}).toPass();
	return dialog;
}

async function chooseFolder(page: Page, folder: string, option: string) {
	await page.getByRole('combobox', { name: 'In Ordner' }).click();
	await page.getByPlaceholder('Pfad suchen oder eingeben …').fill(folder);
	await page.getByRole('option', { name: option, exact: true }).click();
}

test('a page moves with its subpages, and links and old addresses follow it', async ({
	page,
	context,
	request,
	baseURL
}) => {
	const id = Date.now().toString(36);
	const area = `e2e/umzug-${id}`;
	await save(request, baseURL!, `${area}/alt/seite`, `# Seite ${id}\n\nInhalt.`);
	await save(request, baseURL!, `${area}/alt/seite/unter`, `# Unter ${id}\n\nMehr.`);
	await save(
		request,
		baseURL!,
		`${area}/verweis`,
		`# Verweis ${id}\n\n[[Seite ${id}]] und [die Unterseite](/w/${area}/alt/seite/unter).`
	);

	const dialog = await openMoveDialog(page, `${area}/alt/seite`);
	await chooseFolder(page, `${area}/neu`, `Neuer Ordner: ${area}/neu`);
	await expect(dialog).toContainText(`Neue Adresse: /w/${area}/neu/seite`);
	await expect(dialog).toContainText('1 Unterseite wandert mit');
	await expect(dialog).toContainText('1 Seite verlinkt hierher');
	await dialog.getByRole('button', { name: 'Verschieben' }).click();
	await expect(page).toHaveURL(new RegExp(`/w/${area}/neu/seite$`));

	// Old addresses lead on; the subpage went along.
	await page.goto(`/w/${area}/alt/seite/unter`);
	await expect(page).toHaveURL(new RegExp(`/w/${area}/neu/seite/unter$`));
	await page.goto(`/w/${area}/alt/seite`);
	await expect(page).toHaveURL(new RegExp(`/w/${area}/neu/seite$`));

	// The history notes it.
	await page.goto(`/w/${area}/neu/seite/history`);
	await expect(page.getByText(`Verschoben von ${area}/alt/seite`)).toBeVisible();

	// Links to it lead to where it is now.
	await page.goto(`/w/${area}/verweis`);
	const main = page.getByRole('main');
	await expect(main.getByRole('link', { name: `Seite ${id}` })).toHaveAttribute(
		'href',
		`/w/${area}/neu/seite`
	);
	await expect(main.getByRole('link', { name: 'die Unterseite' })).toHaveAttribute(
		'href',
		`/w/${area}/neu/seite/unter`
	);

	// The permanent link works wherever the page is.
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto(`/w/${area}/neu/seite`);
	await main.getByRole('button', { name: 'Link kopieren' }).first().click();
	const permalink = await page.evaluate(() => navigator.clipboard.readText());
	expect(permalink).toMatch(/\/p\/[0-9a-f-]{36}$/);
	await page.goto(permalink);
	await expect(page).toHaveURL(new RegExp(`/w/${area}/neu/seite$`));
});

test('moving says when another page is in the way, and when readers change', async ({
	page,
	request,
	baseURL
}) => {
	const id = Date.now().toString(36);
	const area = `e2e/umzug-check-${id}`;
	await save(request, baseURL!, `${area}/a`, `# A ${id}`);
	await save(request, baseURL!, `${area}/b`, `# B ${id}`);
	await save(request, baseURL!, `${area}/geheim/x`, `# X ${id}`);

	// Someone who may edit there, while it's closed to everyone else — as an
	// admin would set it on /verwaltung.
	const email = `umzug-${id}@example.test`;
	const signUp = await page.request.post('/api/auth/sign-up/email', {
		data: { email, password: 'ein-langes-passwort-123', name: `Mover ${id}` },
		headers: { origin: baseURL! }
	});
	expect(signUp.ok()).toBe(true);
	const db = new Database(DATABASE);
	try {
		const { id: userId } = db.prepare('SELECT id FROM user WHERE email = ?').get(email) as {
			id: string;
		};
		const rule = db.prepare(
			'INSERT INTO access_rule (id, path, subject_type, subject_id, level) VALUES (?, ?, ?, ?, ?)'
		);
		rule.run(randomUUID(), `${area}/geheim`, 'everyone', '', 'none');
		rule.run(randomUUID(), `${area}/geheim`, 'user', userId, 'edit');
	} finally {
		db.close();
	}

	const dialog = await openMoveDialog(page, `${area}/a`);
	await dialog.getByLabel('Name in der Adresse').fill('b');
	await expect(dialog).toContainText(`Unter „${area}/b“ gibt es schon eine Seite.`);
	await expect(dialog.getByRole('button', { name: 'Verschieben' })).toBeDisabled();

	await dialog.getByLabel('Name in der Adresse').fill('a');
	await chooseFolder(page, `${area}/geheim`, `${area}/geheim`);
	await expect(dialog.getByText('Am neuen Ort gelten andere Leserechte')).toBeVisible();
	await expect(dialog).toContainText('Ohne Anmeldung nicht mehr lesbar');
	await expect(dialog).not.toContainText(`Mover ${id}`);
	await expect(dialog.getByRole('button', { name: 'Verschieben' })).toBeEnabled();
});

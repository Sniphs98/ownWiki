import Database from 'better-sqlite3';
import { expect, test, type Browser } from '@playwright/test';

// The default server (AUTH_MODE=disabled): visitors without login count
// as "everyone". Rules only ever name this test's own area, so the other
// tests on this server don't notice them.
const baseURL = 'http://localhost:4173';
const DATABASE = './.data/e2e/disabled/wiki.db';
const PASSWORD = 'ein-langes-passwort-123';

/** Signs a new person up in their own browser context, logged in. */
async function person(browser: Browser, name: string) {
	const email = `${name.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`;
	const context = await browser.newContext({ baseURL });
	const response = await context.request.post('/api/auth/sign-up/email', {
		data: { email, password: PASSWORD, name },
		headers: { origin: baseURL }
	});
	expect(response.ok()).toBe(true);
	return { email, context, page: await context.newPage() };
}

/** Makes someone an admin — in a fresh wiki, the first account is one. */
function makeAdmin(email: string) {
	const db = new Database(DATABASE);
	try {
		db.prepare(`UPDATE user SET role = 'admin' WHERE email = ?`).run(email);
	} finally {
		db.close();
	}
}

test('admins close an area, open it for a group, and everything else follows', async ({
	browser,
	request
}) => {
	const area = `e2e/zugriff-${Date.now().toString(36)}`;
	const secret = `${area}/geheim`;
	const word = `Zugriffsprobe${Date.now().toString(36)}`;
	for (const [path, title] of [
		[secret, 'Geheim'],
		[`${area}/offen`, 'Offen']
	]) {
		const saved = await request.post(`/w/${path}/edit?/save`, {
			form: { content: `# ${title}\n\n${word} auf der Seite ${title}.\n` },
			headers: { origin: baseURL, accept: 'text/html' },
			maxRedirects: 0
		});
		expect(saved.status()).toBe(303);
	}

	const admin = await person(browser, 'Ada');
	makeAdmin(admin.email);
	const member = await person(browser, 'Mia');
	const groupName = `HR ${Date.now().toString(36)}`;

	// The admin sets it up: a group with Mia, closed to everyone, readable for the group.
	await admin.page.goto('/verwaltung');
	await admin.page.getByLabel('Gruppenname').fill(groupName);
	await admin.page.getByRole('button', { name: 'Gruppe anlegen' }).click();
	await admin.page
		.getByLabel(`Person zu ${groupName} hinzufügen`)
		.selectOption({ label: `Mia (${member.email})` });
	await admin.page
		.locator('form', { has: admin.page.getByLabel(`Person zu ${groupName} hinzufügen`) })
		.getByRole('button', { name: 'Hinzufügen' })
		.click();
	await expect(
		admin.page.getByRole('button', { name: `Mia aus ${groupName} entfernen` })
	).toBeVisible();

	const setRule = async (subject: string, level: string) => {
		await admin.page.getByRole('combobox', { name: 'Bereich' }).click();
		await admin.page.getByPlaceholder('Pfad suchen oder eingeben …').fill(secret);
		await admin.page.getByRole('option', { name: secret, exact: true }).click();
		await admin.page.getByLabel('Für').selectOption({ label: subject });
		await admin.page.getByLabel('Recht').selectOption({ label: level });
		await admin.page.getByRole('button', { name: 'Regel setzen' }).click();
		await expect(admin.page.getByText(`: ${level}`).first()).toBeVisible();
	};
	await setRule('Alle', 'Kein Zugriff');
	await setRule(groupName, 'Lesen');
	await expect(admin.page.getByRole('heading', { name: secret })).toBeVisible();

	// Without login: the page is gone — directly, in the sidebar, in the search, as a file.
	expect((await request.get(`/w/${secret}`)).status()).toBe(404);
	expect((await request.get(`/w/${secret}/history`)).status()).toBe(404);
	expect((await request.get(`/w/${area}/offen`)).status()).toBe(200);
	const visitor = await browser.newPage({ baseURL });
	await visitor.goto(`/suche?q=${word}`);
	await expect(visitor.getByRole('link', { name: 'Offen' })).toBeVisible();
	await expect(visitor.getByRole('link', { name: 'Geheim' })).toHaveCount(0);
	await expect(visitor.getByRole('link', { name: 'Geheim', exact: true })).toHaveCount(0);
	await visitor.close();

	// Mia, through her group: may read, not edit.
	expect((await member.page.request.get(`/w/${secret}`)).status()).toBe(200);
	await member.page.goto(`/w/${secret}`);
	await expect(member.page.getByRole('link', { name: 'Bearbeiten' })).toHaveCount(0);
	expect((await member.page.request.get(`/w/${secret}/edit`)).status()).toBe(403);
	const memberSave = await member.page.request.post(`/w/${secret}/edit?/save`, {
		form: { content: '# Geheim\n\nÜberschrieben.' },
		headers: { origin: baseURL },
		maxRedirects: 0
	});
	expect(memberSave.status()).toBe(403);

	// A rule just for Mia goes before her group's.
	await setRule('Mia', 'Bearbeiten');
	expect((await member.page.request.get(`/w/${secret}/edit`)).status()).toBe(200);

	// Admins always may; others don't get to the administration at all.
	expect((await admin.page.request.get(`/w/${secret}/edit`)).status()).toBe(200);
	expect((await member.page.request.get('/verwaltung')).status()).toBe(403);

	await admin.context.close();
	await member.context.close();
});

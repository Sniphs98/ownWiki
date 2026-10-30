import { expect, test, type Browser } from '@playwright/test';

// The default server (AUTH_MODE=disabled): the inbox still needs a login.
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

test('notes go into one’s own inbox and are sorted into pages from there', async ({ browser }) => {
	const id = Date.now().toString(36);
	const { context, page } = await person(browser, 'Nora');
	const other = await person(browser, 'Olaf');

	await page.goto('/inbox');
	await expect(page.getByText('Die Inbox ist leer.')).toBeVisible();
	for (const text of [`Neue Idee ${id}`, `Weg damit ${id}`]) {
		await page.getByRole('textbox', { name: 'Neue Notiz' }).fill(text);
		await page.getByRole('button', { name: 'Notieren' }).click();
		await expect(page.getByText(text)).toBeVisible();
	}
	await expect(page.getByRole('link', { name: 'Inbox, 2 Notizen' })).toBeVisible();

	// Only Nora sees them.
	await other.page.goto('/inbox');
	await expect(other.page.getByText('Die Inbox ist leer.')).toBeVisible();

	const notes = page.getByRole('list', { name: 'Notizen' }).getByRole('listitem');
	await notes
		.filter({ hasText: `Weg damit ${id}` })
		.getByRole('button', { name: 'Notiz löschen' })
		.click();
	await expect(notes).toHaveCount(1);

	// Sorted into a page that doesn't exist yet: it's created from the note.
	const note = notes.filter({ hasText: `Neue Idee ${id}` });
	await note.getByRole('combobox', { name: 'Einsortieren in Seite' }).click();
	await page.getByPlaceholder('Pfad suchen oder eingeben …').fill(`e2e/ideen-${id}`);
	await page.getByRole('option', { name: `Neue Seite anlegen: e2e/ideen-${id}` }).click();
	await expect(note.getByRole('combobox', { name: 'Einsortieren in Seite' })).toHaveText(
		`e2e/ideen-${id}`
	);
	await note.getByRole('button', { name: 'Einsortieren' }).click();
	await expect(page).toHaveURL(new RegExp(`/w/e2e/ideen-${id}$`));
	await expect(page.getByRole('heading', { name: `Ideen ${id}` })).toBeVisible();
	await expect(page.getByText(`Neue Idee ${id}`)).toBeVisible();

	await page.goto('/inbox');
	await expect(page.getByText('Die Inbox ist leer.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Inbox', exact: true })).toBeVisible();

	await context.close();
	await other.context.close();
});

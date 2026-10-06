import { expect, test, type Page } from '@playwright/test';

// Seeded by e2e/setup-db.js. Nothing else edits this page.
const PATH = 'e2e/long-text';

const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Formatierung' });

async function openEditor(page: Page) {
	await page.goto(`/w/${PATH}/edit`);
	await expect(toolbar(page)).toBeVisible({ timeout: 30_000 });
}

async function hideInSettings(page: Page, label: string) {
	await page.goto('/settings', { waitUntil: 'networkidle' });
	await page.locator('li', { hasText: label }).getByRole('button', { name: 'Ausblenden' }).click();
	await page.getByRole('button', { name: 'Speichern' }).click();
	await expect(page.getByRole('status')).toHaveText('Gespeichert.');
}

test('the toolbar formats the selected text', async ({ page }) => {
	await openEditor(page);
	await page.locator('.ProseMirror p').first().dblclick();
	const bold = toolbar(page).getByRole('button', { name: 'Fett' });
	await bold.click();

	await expect(bold).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('input[name=content]')).toHaveValue(/\*\*\S+\*\*/);
});

test('without an account, the toolbar layout is kept in the browser', async ({ page }) => {
	await hideInSettings(page, 'Durchgestrichen');

	await openEditor(page);
	await expect(toolbar(page).getByRole('button', { name: 'Fett' })).toBeVisible();
	await expect(toolbar(page).getByRole('button', { name: 'Durchgestrichen' })).toHaveCount(0);

	await page.goto('/settings', { waitUntil: 'networkidle' });
	await page.getByRole('button', { name: 'Standard wiederherstellen' }).click();
	await expect(page.getByRole('status')).toHaveText('Gespeichert.');
	await openEditor(page);
	await expect(toolbar(page).getByRole('button', { name: 'Durchgestrichen' })).toBeVisible();
});

test('signed in, the toolbar layout follows the account', async ({ page, browser, baseURL }) => {
	const email = `toolbar-${Date.now()}@example.test`;
	const password = 'ein-langes-passwort-123';
	const signUp = await page.request.post('/api/auth/sign-up/email', {
		data: { email, password, name: 'Leisten Test' },
		headers: { origin: baseURL! }
	});
	expect(signUp.ok()).toBe(true);

	await hideInSettings(page, 'Kursiv');

	// A second, separate browser session: nothing in its local storage.
	const other = await browser.newContext();
	const otherPage = await other.newPage();
	const signIn = await otherPage.request.post('/api/auth/sign-in/email', {
		data: { email, password },
		headers: { origin: baseURL! }
	});
	expect(signIn.ok()).toBe(true);
	await openEditor(otherPage);
	await expect(toolbar(otherPage).getByRole('button', { name: 'Fett' })).toBeVisible();
	await expect(toolbar(otherPage).getByRole('button', { name: 'Kursiv' })).toHaveCount(0);
	await other.close();
});

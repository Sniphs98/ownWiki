import { expect, test, type Page } from '@playwright/test';

// Seeded by e2e/setup-db.js; only this file's tests touch it.
const PATH = 'e2e/files';

const content = (page: Page) => page.locator('input[name=content]');

/** The editor itself, not the hidden copy the page-break preview measures. */
const onPage = (page: Page, selector: string, options?: { hasText: string }) =>
	page.locator(`.ProseMirror:not(.page-break-measure *) ${selector}`, options);

/** Uploads a file through "/" → Datei at the end of the first paragraph. */
async function uploadViaSlashMenu(page: Page, name: string) {
	await onPage(page, 'p', { hasText: 'Hier kommt eine Datei hin.' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/');
	const chooser = page.waitForEvent('filechooser');
	await page.getByText('Datei', { exact: true }).click();
	await (
		await chooser
	).setFiles({
		name,
		mimeType: 'text/plain',
		buffer: Buffer.from(`Inhalt von ${name}`)
	});
	await expect
		.poll(async () => (await content(page).inputValue()).includes(`[${name}](/api/files/`))
		.toBe(true);
}

test.describe.configure({ mode: 'serial' });

test('a file uploaded via the "/" menu becomes a link in the text', async ({ page, baseURL }) => {
	await page.goto(`/w/${PATH}/edit`, { waitUntil: 'networkidle' });
	await uploadViaSlashMenu(page, 'Handbuch v2.txt');

	// Clicking the link while editing must not leave the page.
	await onPage(page, 'a', { hasText: 'Handbuch v2.txt' }).click();
	await expect(page).toHaveURL(new RegExp(`/w/${PATH}/edit$`));

	await page.getByRole('button', { name: 'Speichern' }).click();
	await page.waitForURL(`**/w/${PATH}`);

	const link = onPage(page, 'a', { hasText: 'Handbuch v2.txt' });
	await expect(link).toBeVisible({ timeout: 15_000 });
	await expect(page.getByText('Anhänge', { exact: true })).toHaveCount(0);

	const href = (await link.getAttribute('href'))!;
	const download = await page.request.get(href);
	expect(download.status()).toBe(200);
	expect(await download.text()).toBe('Inhalt von Handbuch v2.txt');
	expect(download.headers()['content-disposition']).toContain("filename*=UTF-8''Handbuch%20v2.txt");

	// In the PDF layout the link is absolute, and still a plain link.
	await page.goto(`/print/${PATH}`);
	await page.locator('body[data-print-ready="true"]').waitFor({ state: 'attached' });
	await expect(page.locator('.pagedjs_pages a', { hasText: 'Handbuch v2.txt' })).toHaveAttribute(
		'href',
		`${baseURL}${href}`
	);
});

test('files no longer linked in the text can be put back', async ({ page }) => {
	await page.goto(`/w/${PATH}/edit`, { waitUntil: 'networkidle' });
	const link = onPage(page, 'a', { hasText: 'Handbuch v2.txt' });
	await expect(link).toBeVisible({ timeout: 15_000 });
	const insert = page.getByRole('button', { name: '„Handbuch v2.txt“ einfügen' });
	await expect(insert).toHaveCount(0);

	// Delete the paragraph holding the link.
	await link.click();
	await page.keyboard.press('Home');
	await page.keyboard.press('Shift+End');
	await page.keyboard.press('Delete');
	await expect(insert).toBeVisible();

	await onPage(page, 'p', { hasText: 'Hier kommt eine Datei hin.' }).click();
	await page.keyboard.press('End');
	await insert.click();
	await expect(insert).toHaveCount(0);
	await expect(content(page)).toHaveValue(/\[Handbuch v2\.txt\]\(\/api\/files\//);
});

import { expect, test, type Page } from '@playwright/test';

// Seeded by e2e/setup-db.js; only this file's tests give it a title page.
const PATH = 'e2e/handbuch/betrieb';

// A 1×1 PNG.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

const dialog = (page: Page) => page.getByRole('dialog', { name: 'PDF exportieren' });
const coverEditor = (page: Page) => dialog(page).locator('[data-cover-editor] .ProseMirror');

/** Clicks "PDF" until the dialog opens — a click before hydration does nothing. */
async function clickPdf(page: Page) {
	await expect(async () => {
		await page.getByRole('button', { name: 'PDF', exact: true }).click();
		await expect(dialog(page)).toBeVisible({ timeout: 1000 });
	}).toPass();
}

async function openExportDialog(page: Page) {
	await page.goto(`/w/${PATH}`);
	await clickPdf(page);
}

async function openPrintView(page: Page, query: string) {
	await page.goto(`/print/${PATH}?${query}`);
	await page.locator('body[data-print-ready="true"]').waitFor({ state: 'attached' });
}

test.describe.configure({ mode: 'serial' });

test('the title page is an A4 sheet, greyed out until switched on', async ({ page }) => {
	await openExportDialog(page);
	const sheet = dialog(page).locator('[data-cover-sheet]');
	const box = (await sheet.boundingBox())!;
	expect(box.height / box.width).toBeCloseTo(297 / 210, 2);

	const area = dialog(page).getByLabel('Titelseite', { exact: true });
	await expect(area).toHaveAttribute('inert');
	await expect(area).toHaveCSS('opacity', '0.4');

	await dialog(page).getByRole('switch', { name: 'Eigene Titelseite' }).check();
	await expect(area).not.toHaveAttribute('inert');
	await expect(area).toHaveCSS('opacity', '1');
});

test('the title page is written in the dialog, saved and exported as page 1', async ({ page }) => {
	await openExportDialog(page);
	await dialog(page).getByRole('switch', { name: 'Eigene Titelseite' }).check();
	await dialog(page)
		.getByRole('group', { name: 'Senkrecht' })
		.getByRole('button', { name: 'Oben' })
		.click();
	await coverEditor(page).click();
	await page.keyboard.type('# Betriebshandbuch');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Abteilung IT');

	const download = page.waitForEvent('download');
	await dialog(page).getByRole('button', { name: 'PDF herunterladen' }).click();
	expect((await download).suggestedFilename()).toBe('e2e-handbuch-betrieb.pdf');
	await expect(dialog(page)).toBeHidden();

	// Saved with the page: the dialog brings it back.
	await openExportDialog(page);
	await expect(dialog(page).getByRole('switch', { name: 'Eigene Titelseite' })).toBeChecked();
	await expect(coverEditor(page)).toContainText('Betriebshandbuch');
	await expect(
		dialog(page).getByRole('group', { name: 'Senkrecht' }).getByRole('button', { name: 'Oben' })
	).toHaveAttribute('aria-pressed', 'true');
});

test('the title page replaces the generated cover, before the contents page', async ({ page }) => {
	await openPrintView(page, 'cover=1&toc=1');
	const pages = page.locator('.pagedjs_page');
	await expect(pages.nth(0).locator('.wiki-cover-custom h1')).toHaveText('Betriebshandbuch');
	await expect(pages.nth(0)).toContainText('Abteilung IT');
	// Aligned as chosen: at the top of the page, centred across it.
	const cover = pages.nth(0).locator('.wiki-cover-page');
	await expect(cover).toHaveAttribute('data-align-y', 'start');
	const heading = (await cover.locator('h1').boundingBox())!;
	const pageBox = (await pages.nth(0).boundingBox())!;
	expect(heading.y - pageBox.y).toBeLessThan(pageBox.height * 0.2);
	const text = await cover.locator('h1').evaluate((h1) => {
		const range = document.createRange();
		range.selectNodeContents(h1);
		const rect = range.getBoundingClientRect();
		return rect.left + rect.width / 2;
	});
	expect(Math.abs(text - (pageBox.x + pageBox.width / 2))).toBeLessThan(4);
	await expect(page.locator('.wiki-cover')).toHaveCount(1);
	// Its heading is no section: not in the contents.
	await expect(pages.nth(1).locator('.wiki-toc .wiki-toc-text')).toHaveText([
		'Betrieb',
		'Sicherung'
	]);

	// Without it, the generated cover is back.
	await openPrintView(page, 'toc=1');
	await expect(page.locator('.wiki-cover-custom')).toHaveCount(0);
	await expect(page.locator('.wiki-cover h1')).toHaveText('Betrieb');
});

test('images on the title page end up in the PDF and stay out of "unlinked files"', async ({
	page
}) => {
	await openExportDialog(page);
	await coverEditor(page).click();
	await page.keyboard.press('Control+End');
	await page.keyboard.press('Enter');
	await dialog(page)
		.getByRole('toolbar')
		.getByRole('button', { name: 'Bild', exact: true })
		.click();
	await dialog(page)
		.locator('.milkdown-image-block input[type=file]')
		.setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
	await expect(coverEditor(page).locator('img[src*="/api/files/"]')).toBeAttached();
	const download = page.waitForEvent('download');
	await dialog(page).getByRole('button', { name: 'PDF herunterladen' }).click();
	await download;

	await openPrintView(page, 'cover=1');
	await expect(
		page.locator('.pagedjs_page').first().locator('.wiki-cover-custom img[src^="data:image/png"]')
	).toBeAttached();

	await page.goto(`/w/${PATH}/edit`);
	await expect(page.locator('.ProseMirror').first()).toBeVisible();
	await expect(page.getByText('logo.png')).toHaveCount(0);
});

test('the dialog exports subpages and the contents page as chosen', async ({ page }) => {
	await page.goto('/w/e2e/handbuch');
	await clickPdf(page);
	await dialog(page).getByRole('switch', { name: 'Mit Unterseiten' }).check();
	await dialog(page).getByRole('switch', { name: 'Inhaltsverzeichnis' }).uncheck();

	const request = page.waitForRequest((r) => r.url().includes('/api/pdf/'));
	await dialog(page).getByRole('button', { name: 'PDF herunterladen' }).click();
	const url = new URL((await request).url());
	expect(url.searchParams.get('scope')).toBe('subtree');
	expect(url.searchParams.get('toc')).toBe('0');
	expect(url.searchParams.has('cover')).toBe(false);
});

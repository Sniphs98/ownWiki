import { expect, test, type Page } from '@playwright/test';

// Seeded by e2e/setup-db.js: Handbuch with the subpages Betrieb and
// Einrichtung (which runs over several pages).
const GROUP = 'e2e/handbuch';

async function openPrintView(page: Page, path: string) {
	await page.goto(`/print/${path}`);
	await page.locator('body[data-print-ready="true"]').waitFor({ state: 'attached' });
}

async function downloadPdf(page: Page, path: string): Promise<string> {
	const response = await page.request.get(`/api/pdf/${path}`);
	expect(response.status()).toBe(200);
	return (await response.body()).toString('latin1');
}

test('a multi-page export starts with a contents page after the cover', async ({ page }) => {
	await openPrintView(page, `${GROUP}?scope=subtree`);

	const toc = page.locator('.pagedjs_page .wiki-toc');
	await expect(toc.locator('.wiki-toc-text')).toHaveText([
		'Handbuch',
		'Aufbau',
		'Betrieb',
		'Sicherung',
		'Einrichtung',
		'Voraussetzungen',
		'Installation'
	]);
	// Second page, right after the cover.
	await expect(page.locator('.pagedjs_page').nth(1).locator('.wiki-toc')).toBeAttached();

	// Every entry shows the page its target actually landed on.
	const mismatches = await page.evaluate(() =>
		[...document.querySelectorAll<HTMLAnchorElement>('.wiki-toc a')].flatMap((link) => {
			// pagedjs resolves target-counter() into a counter-reset with the number.
			const shown = getComputedStyle(link, '::after').counterReset.split(' ')[1];
			const target = document.getElementById(link.hash.slice(1));
			const actual = target?.closest<HTMLElement>('.pagedjs_page')?.dataset.pageNumber;
			return shown === actual ? [] : [`${link.textContent}: ${shown} ≠ ${actual}`];
		})
	);
	expect(mismatches).toEqual([]);
});

test('a single page has no contents page', async ({ page }) => {
	await openPrintView(page, GROUP);
	await expect(page.locator('.pagedjs_page').first()).toBeAttached();
	await expect(page.locator('.wiki-toc')).toHaveCount(0);
});

test('the PDF has bookmarks, also for a single page', async ({ page }) => {
	for (const path of [`${GROUP}?scope=subtree`, GROUP]) {
		const pdf = await downloadPdf(page, path);
		expect(pdf, path).toContain('/Outlines');
	}
});

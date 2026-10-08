import { expect, test, type Page } from '@playwright/test';

// Seeded by e2e/setup-db.js: Handbuch with the subpages Betrieb and
// Einrichtung (which runs over several pages).
const GROUP = 'e2e/handbuch';
const LONG_PAGE = 'e2e/handbuch/einrichtung';

async function openPrintView(page: Page, pathAndQuery: string) {
	await page.goto(`/print/${pathAndQuery}`);
	await page.locator('body[data-print-ready="true"]').waitFor({ state: 'attached' });
}

async function downloadPdf(page: Page, pathAndQuery: string): Promise<string> {
	const response = await page.request.get(`/api/pdf/${pathAndQuery}`);
	expect(response.status()).toBe(200);
	return (await response.body()).toString('latin1');
}

/** Entries on the contents page whose page number isn't where their target landed. */
function wrongPageNumbers(page: Page) {
	return page.evaluate(() =>
		[...document.querySelectorAll<HTMLAnchorElement>('.wiki-toc a')].flatMap((link) => {
			// pagedjs resolves target-counter() into a counter-reset with the number.
			const shown = getComputedStyle(link, '::after').counterReset.split(' ')[1];
			const target = document.getElementById(link.hash.slice(1));
			const actual = target?.closest<HTMLElement>('.pagedjs_page')?.dataset.pageNumber;
			return shown === actual ? [] : [`${link.textContent}: ${shown} ≠ ${actual}`];
		})
	);
}

const secondPage = (page: Page) => page.locator('.pagedjs_page').nth(1);

test('with subpages, the contents page follows the cover', async ({ page }) => {
	await openPrintView(page, `${GROUP}?scope=subtree&toc=1`);

	await expect(secondPage(page).locator('.wiki-toc .wiki-toc-text')).toHaveText([
		'Handbuch',
		'Aufbau',
		'Betrieb',
		'Sicherung',
		'Einrichtung',
		'Voraussetzungen',
		'Installation'
	]);
	expect(await wrongPageNumbers(page)).toEqual([]);
});

test('a single page gets a cover, then the contents page', async ({ page }) => {
	await openPrintView(page, `${LONG_PAGE}?toc=1`);

	const cover = page.locator('.pagedjs_page').first().locator('.wiki-cover');
	await expect(cover.locator('h1')).toHaveText('Einrichtung');
	await expect(secondPage(page).locator('.wiki-toc .wiki-toc-text')).toHaveText([
		'Einrichtung',
		'Voraussetzungen',
		'Installation'
	]);
	expect(await wrongPageNumbers(page)).toEqual([]);
});

test('without the checkbox there is no cover or contents page', async ({ page }) => {
	for (const query of [`${LONG_PAGE}?toc=0`, `${GROUP}?scope=subtree&toc=0`]) {
		await openPrintView(page, query);
		await expect(page.locator('.pagedjs_page').first()).toBeAttached();
		await expect(page.locator('.wiki-toc'), query).toHaveCount(0);
	}
	await expect(page.locator('.wiki-cover')).toHaveCount(1); // the group's cover only
});

test('the checkbox decides what the export links ask for', async ({ page }) => {
	await page.goto(`/w/${GROUP}`);
	const checkbox = page.getByRole('checkbox', { name: 'Inhaltsverzeichnis' });
	const pdfLink = page.getByRole('link', { name: 'PDF', exact: true });

	await expect(checkbox).toBeChecked();
	await expect(pdfLink).toHaveAttribute('href', `/api/pdf/${GROUP}?toc=1`);
	await expect(page.getByRole('link', { name: 'mit Unterseiten' })).toHaveAttribute(
		'href',
		`/api/pdf/${GROUP}?scope=subtree&toc=1`
	);

	await checkbox.uncheck();
	await expect(pdfLink).toHaveAttribute('href', `/api/pdf/${GROUP}?toc=0`);
	await page.reload();
	await expect(checkbox).not.toBeChecked();
});

test('the PDF has the contents page and bookmarks, bookmarks also without it', async ({ page }) => {
	const withToc = await downloadPdf(page, `${LONG_PAGE}?toc=1`);
	const withoutToc = await downloadPdf(page, `${LONG_PAGE}?toc=0`);
	const pageCount = (pdf: string) => pdf.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
	// Cover and contents page.
	expect(pageCount(withToc)).toBe(pageCount(withoutToc) + 2);
	for (const pdf of [withToc, withoutToc]) expect(pdf).toContain('/Outlines');
});

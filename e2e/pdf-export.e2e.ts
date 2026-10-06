import { expect, test, type Page } from '@playwright/test';

// Seeded by e2e/setup-db.js from e2e/fixtures/pdf-export.md: long paragraphs,
// a 40-row table that can't fit on one page, a code block, a quote, lists.
const PATH = 'e2e/pdf-export';
const TABLE_ROWS = 40;

/** Opens the paginated print view — the exact layout the PDF is printed from. */
async function openPrintView(page: Page) {
	await page.goto(`/print/${PATH}`);
	await page.locator('body[data-print-ready="true"]').waitFor({ state: 'attached' });
}

async function downloadPdf(page: Page): Promise<string> {
	const response = await page.request.get(`/api/pdf/${PATH}`);
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toBe('application/pdf');
	// latin1 keeps every byte as one char, so PDF syntax can be matched as text.
	return (await response.body()).toString('latin1');
}

/**
 * The first characters of every rendered line of text inside `root`, in
 * document order. Two layouts with identical lists wrap text identically.
 */
function lineStarts(page: Page, root: string): Promise<string[]> {
	return page.evaluate((root) => {
		const starts: string[] = [];
		const range = document.createRange();
		const blocks = document.querySelectorAll(
			`${root} :is(p, h1, h2, h3, h4, li):not(table *, li li)`
		);
		for (const block of blocks) {
			const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
			let lastTop: number | null = null;
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				const text = node as Text;
				for (let i = 0; i < text.length; i++) {
					range.setStart(text, i);
					range.setEnd(text, i + 1);
					const rect = range.getClientRects()[0];
					if (!rect) continue;
					if (lastTop === null || Math.abs(rect.top - lastTop) > 3) {
						starts.push(text.data.slice(i, i + 15));
						lastTop = rect.top;
					}
				}
			}
		}
		return starts;
	}, root);
}

test('text wraps identically on the page view and in the PDF layout', async ({ page }) => {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto(`/w/${PATH}`);
	await page.locator('.milkdown .ProseMirror p').first().waitFor();
	await page.evaluate(() => document.fonts.ready);
	const onScreen = await lineStarts(page, '.milkdown .ProseMirror');

	await openPrintView(page);
	const inPrint = await lineStarts(page, '.pagedjs_area .ProseMirror');

	expect(onScreen.length).toBeGreaterThan(20);
	expect(inPrint).toEqual(onScreen);
});

test('PDF has no empty pages and as many pages as the print layout', async ({ page }) => {
	await openPrintView(page);
	const sheets = page.locator('.pagedjs_page');
	const sheetCount = await sheets.count();
	expect(sheetCount).toBeGreaterThan(1);

	for (let i = 0; i < sheetCount; i++) {
		const text = await sheets.nth(i).locator('.pagedjs_page_content').innerText();
		expect(text.trim(), `page ${i + 1} is empty`).not.toBe('');
	}

	const pdf = await downloadPdf(page);
	const pdfPages = pdf.match(/\/Type\s*\/Page(?![s\w])/g) ?? [];
	expect(pdfPages).toHaveLength(sheetCount);
});

test('long tables break across pages and repeat their header row', async ({ page }) => {
	await openPrintView(page);

	const tablePages = await page.evaluate(() =>
		[...document.querySelectorAll('.pagedjs_page')]
			.map((sheet) => ({
				bodyRows: sheet.querySelectorAll('tbody tr').length,
				header: sheet.querySelector('thead')?.textContent ?? ''
			}))
			.filter((p) => p.bodyRows > 0)
	);

	expect(tablePages.length).toBeGreaterThan(1);
	for (const tablePage of tablePages) expect(tablePage.header).toContain('Verantwortlich');
	expect(tablePages.reduce((sum, p) => sum + p.bodyRows, 0)).toBe(TABLE_ROWS);
});

test('long code blocks are printed completely, numbered and split by line', async ({ page }) => {
	await page.goto('/print/e2e/long-code');
	await page.locator('body[data-print-ready="true"]').waitFor({ state: 'attached' });

	const sheets = await page.evaluate(() =>
		[...document.querySelectorAll('.pagedjs_page')].map((sheet) =>
			[...sheet.querySelectorAll('.cm-line')].map((line) => ({
				text: line.textContent?.trim(),
				number: line.parentElement?.querySelector('.cm-gutterElement')?.textContent
			}))
		)
	);
	const lines = sheets.flat();

	expect(sheets.filter((sheet) => sheet.length > 0).length).toBeGreaterThan(1);
	expect(lines).toHaveLength(150);
	lines.forEach((line, i) => {
		expect(line.text).toBe(`zeile_${String(i + 1).padStart(3, '0')}: wert ${i + 1}`);
		expect(line.number).toBe(String(i + 1));
	});
});

test('editor controls are not part of the printed pages', async ({ page }) => {
	await openPrintView(page);
	const controls = page.locator(
		'.pagedjs_pages :is(.handle, .drag-preview, .milkdown-block-handle, .milkdown-toolbar, [contenteditable])'
	);
	await expect(controls).toHaveCount(0);
});

test('PDF uses the bundled fonts, not system fallbacks', async ({ page }) => {
	const pdf = await downloadPdf(page);
	// Our variable web fonts are embedded as unnamed Type 3 fonts; a named
	// system font means some text fell back to whatever the server has
	// installed, which is not what the reader saw on screen.
	const namedFonts = pdf.match(/\/BaseFont\s*\/[^\s/>]+/g) ?? [];
	expect(namedFonts).toEqual([]);
});

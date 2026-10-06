import { expect, test, type Page } from '@playwright/test';

// Seeded by e2e/setup-db.js. pdf-export breaks between blocks and inside a
// table; long-text consists of long paragraphs, so pages begin mid-paragraph;
// long-code has a 150-line code block, so pages begin between code lines.
const PATHS = ['e2e/pdf-export', 'e2e/long-text', 'e2e/long-code'];

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Text each page after the first begins with, in the real print layout. */
async function printedPageStarts(page: Page, path: string): Promise<string[]> {
	await page.goto(`/print/${path}`);
	await page.locator('body[data-print-ready="true"]').waitFor({ state: 'attached' });
	return page.evaluate(() =>
		[...document.querySelectorAll('.pagedjs_page')].slice(1).map((sheet) => {
			const content = sheet.querySelector('.pagedjs_page_content')!.cloneNode(true) as Element;
			// A repeated table header is not where the page's own content begins.
			// Neither is a repeated table header or a code line number.
			content
				.querySelectorAll('[data-repeated-header], [data-print-gutter]')
				.forEach((el) => el.remove());
			return content.textContent ?? '';
		})
	);
}

async function markerStarts(page: Page, expectedCount: number): Promise<string[]> {
	const markers = page.locator('[data-page-break]');
	await expect(markers).toHaveCount(expectedCount, { timeout: 15_000 });
	return markers.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.startText ?? ''));
}

for (const path of PATHS) {
	test(`page-break markers match the PDF page starts (${path})`, async ({ page }) => {
		await page.setViewportSize({ width: 1400, height: 900 });
		const printed = await printedPageStarts(page, path);
		expect(printed.length).toBeGreaterThan(0);

		for (const view of [`/w/${path}`, `/w/${path}/edit`]) {
			await page.goto(view);
			const markers = await markerStarts(page, printed.length);
			markers.forEach((start, i) => {
				expect(start, `${view}: marker for page ${i + 2}`).not.toBe('');
				const expected = normalize(start);
				expect(normalize(printed[i]).slice(0, expected.length), `${view}: page ${i + 2}`).toBe(
					expected
				);
			});
		}
	});
}

test('page-break markers can be hidden and stay hidden', async ({ page }) => {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto(`/w/${PATHS[0]}`);
	const markers = page.locator('[data-page-break]');
	await expect(markers.first()).toBeAttached({ timeout: 15_000 });

	await page.getByRole('button', { name: 'Seitenumbrüche' }).click();
	await expect(markers).toHaveCount(0);

	await page.reload();
	await page.locator('.milkdown .ProseMirror').waitFor();
	await page.waitForTimeout(2000);
	await expect(markers).toHaveCount(0);
});

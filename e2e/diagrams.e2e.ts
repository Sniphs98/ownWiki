import { expect, test, type Page } from '@playwright/test';

// Seeded by e2e/setup-db.js: one ```mermaid and one ```bpmn code block.

/**
 * Elements in the page's editor — not in the off-screen copy the
 * page-break preview lays out now and then (page-break-markers.svelte).
 */
function onPage(page: Page, selector: string) {
	return page.locator(`.milkdown-editor-root:not(.page-break-measure *) ${selector}`);
}
const PATH = 'e2e/diagrams';

/** Fails the test if the page loads anything from outside the wiki. */
function forbidExternalRequests(page: Page, baseURL: string) {
	const external: string[] = [];
	page.on('request', (request) => {
		const url = request.url();
		if (!url.startsWith(baseURL) && !url.startsWith('blob:') && !url.startsWith('data:')) {
			external.push(url);
		}
	});
	return external;
}

test('diagrams render in the page view and in the PDF layout', async ({ page, baseURL }) => {
	const external = forbidExternalRequests(page, baseURL!);

	await page.goto(`/w/${PATH}`);
	await expect(onPage(page, '.wiki-diagram svg')).toHaveCount(2, { timeout: 30_000 });
	await expect(onPage(page, '.wiki-diagram-error')).toHaveCount(0);
	await expect(onPage(page, '.wiki-diagram[data-diagram="mermaid"]')).toContainText('Vollständig?');
	await expect(onPage(page, '.wiki-diagram[data-diagram="bpmn"]')).toContainText('Antrag prüfen');
	// Readonly: no edit buttons, no source code.
	await expect(page.locator('[data-diagram-edit]:visible')).toHaveCount(0);

	await page.goto(`/print/${PATH}`);
	await page.locator('body[data-print-ready="true"]').waitFor({ state: 'attached' });
	await expect(page.locator('.pagedjs_pages .wiki-diagram svg')).toHaveCount(2);
	await expect(page.locator('.pagedjs_pages [data-diagram-edit]')).toHaveCount(0);

	expect(external).toEqual([]);
});

test('a mermaid diagram can be edited in the dialog', async ({ page }) => {
	await page.goto(`/w/${PATH}/edit`);
	const mermaid = onPage(page, '.wiki-diagram[data-diagram="mermaid"]');
	await expect(mermaid.locator('.wiki-diagram-canvas > svg')).toBeVisible({ timeout: 30_000 });

	await mermaid.getByRole('button', { name: 'Bearbeiten' }).click();
	await page.getByLabel('Mermaid-Quelltext').fill('flowchart LR\n    X[Vorher] --> Y[Nachher]');
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(mermaid).toContainText('Nachher');
	await expect(page.locator('input[name=content]')).toHaveValue(/X\[Vorher\] --> Y\[Nachher\]/);
});

test('an Excalidraw drawing can be inserted, drawn and saved', async ({ page, baseURL }) => {
	const external = forbidExternalRequests(page, baseURL!);
	// A new page of its own, so the other tests' page stays as seeded.
	const path = 'e2e/neue-zeichnung';
	await page.goto(`/w/${path}/edit?title=Neue%20Zeichnung`);
	await page.locator('.milkdown .ProseMirror').click();
	await page.keyboard.type('/');
	await page.getByText('Excalidraw-Zeichnung').click();

	const canvas = page.locator('.excalidraw canvas.interactive');
	await canvas.waitFor({ state: 'attached', timeout: 30_000 });
	await page.getByRole('radio', { name: 'Rechteck' }).click({ force: true });
	const box = (await canvas.boundingBox())!;
	await page.mouse.move(box.x + 300, box.y + 200);
	await page.mouse.down();
	await page.mouse.move(box.x + 600, box.y + 400, { steps: 8 });
	await page.mouse.up();
	await page.getByRole('button', { name: 'Übernehmen' }).click();

	await expect(onPage(page, '.wiki-diagram[data-diagram="excalidraw"] svg')).toBeVisible({
		timeout: 30_000
	});
	await page.getByRole('button', { name: 'Speichern' }).click();
	await page.waitForURL(`**/w/${path}`);

	await expect(onPage(page, '.wiki-diagram[data-diagram="excalidraw"] svg')).toBeVisible({
		timeout: 30_000
	});
	expect(external).toEqual([]);
});

test('a diagram that starts a PDF page gets its page-break marker', async ({ page }) => {
	// Seeded: three paragraphs, then a BPMN diagram without any text that is
	// too tall to fit below them, so it starts page 2.
	const path = 'e2e/diagram-break';
	await page.goto(`/print/${path}`);
	await page.locator('body[data-print-ready="true"]').waitFor({ state: 'attached' });
	const sheets = page.locator('.pagedjs_page');
	await expect(sheets.nth(0).locator('.wiki-diagram')).toHaveCount(0);
	await expect(sheets.nth(1).locator('.wiki-diagram[data-diagram="bpmn"]')).toHaveCount(1);
	// The diagram's hidden source editor is not laid out at all.
	await expect(page.locator('.pagedjs_pages .codemirror-host')).toHaveCount(0);

	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto(`/w/${path}`);
	const marker = page.locator('[data-page-break="2"]');
	await expect(marker).toBeAttached({ timeout: 15_000 });
	const markerTop = await marker.evaluate((el) => el.getBoundingClientRect().top);
	const diagramTop = await page
		.locator('.wiki-diagram[data-diagram="bpmn"]')
		.evaluate((el) => el.getBoundingClientRect().top);
	expect(Math.abs(markerTop - diagramTop)).toBeLessThan(12);
});

import { expect, test, type Page } from '@playwright/test';

// Seeded by e2e/setup-db.js; headings: Einleitung, Konfiguration,
// Zuständigkeiten, Checkliste, Abschluss.
const PATH = 'e2e/pdf-export';

const aside = (page: Page) => page.getByRole('navigation', { name: 'Auf dieser Seite' });

test('the open page shows in the page tree, inside its opened folder', async ({ page }) => {
	await page.goto(`/w/${PATH}`);
	await expect(
		page.locator('[data-sidebar="menu-button"]', { hasText: 'PDF-Export Prüfseite' })
	).toBeVisible();
});

test('the sections beside the text list the headings and jump to them', async ({ page }) => {
	await page.setViewportSize({ width: 1920, height: 1000 });
	await page.goto(`/w/${PATH}`);

	await expect(aside(page).getByRole('button')).toHaveText([
		'Einleitung',
		'Konfiguration',
		'Zuständigkeiten',
		'Checkliste',
		'Abschluss'
	]);

	await aside(page).getByRole('button', { name: 'Zuständigkeiten' }).click();
	const heading = page.locator('.ProseMirror h2', { hasText: 'Zuständigkeiten' });
	await expect
		.poll(() => heading.evaluate((el) => Math.round(el.getBoundingClientRect().top)))
		.toBeLessThan(200);
	await expect(aside(page).locator('[aria-current="location"]')).toHaveText('Zuständigkeiten');
});

test('while editing, new headings show up right away', async ({ page }) => {
	await page.setViewportSize({ width: 1920, height: 1000 });
	await page.goto(`/w/${PATH}/edit`);
	await expect(aside(page)).toBeVisible({ timeout: 15_000 });

	await page.locator('.ProseMirror h2', { hasText: 'Abschluss' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('## Nachtrag');

	await expect(aside(page).getByRole('button').last()).toHaveText('Nachtrag');
});

test('the sections only show where they fit beside the text', async ({ page }) => {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto(`/w/${PATH}`);
	await expect(page.locator('.ProseMirror h2').first()).toBeVisible();
	await expect(aside(page)).toBeHidden();
	// And no table of contents in the page tree any more.
	await expect(page.locator('[data-sidebar="content"]')).not.toContainText('Zuständigkeiten');
});

test('the page actions sit above the sections when there is room, else above the text', async ({
	page
}) => {
	const pdfLink = page.getByRole('link', { name: 'PDF', exact: true });
	const text = page.locator('.milkdown .ProseMirror').first();

	await page.setViewportSize({ width: 1920, height: 1000 });
	await page.goto(`/w/${PATH}`);
	await expect(aside(page)).toBeVisible();
	const link = (await pdfLink.boundingBox())!;
	expect(link.x).toBeGreaterThan((await text.boundingBox())!.x + 600);
	expect(link.y).toBeLessThan((await aside(page).boundingBox())!.y);

	await page.setViewportSize({ width: 1300, height: 900 });
	await expect(aside(page)).toBeHidden();
	await expect(pdfLink).toBeVisible();
	expect((await pdfLink.boundingBox())!.y).toBeLessThan((await text.boundingBox())!.y);
	// No paginated preview button any more.
	await expect(page.getByRole('link', { name: 'Seitenweise' })).toHaveCount(0);
});

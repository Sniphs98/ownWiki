import { expect, test, type Page } from '@playwright/test';

// Seeded by e2e/setup-db.js; headings: Einleitung, Konfiguration,
// Zuständigkeiten, Checkliste, Abschluss.
const PATH = 'e2e/pdf-export';

const toc = (page: Page) => page.getByRole('list', { name: 'Inhaltsverzeichnis' });

test('the open page lists its headings in the page tree and jumps to them', async ({ page }) => {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto(`/w/${PATH}`);

	// The page itself shows in the tree, inside its (opened) folder.
	await expect(
		page.locator('[data-sidebar="menu-button"]', { hasText: 'PDF-Export Prüfseite' })
	).toBeVisible();

	await expect(toc(page).getByRole('button')).toHaveText([
		'Einleitung',
		'Konfiguration',
		'Zuständigkeiten',
		'Checkliste',
		'Abschluss'
	]);

	await toc(page).getByRole('button', { name: 'Zuständigkeiten' }).click();
	const heading = page.locator('.ProseMirror h2', { hasText: 'Zuständigkeiten' });
	await expect
		.poll(() => heading.evaluate((el) => Math.round(el.getBoundingClientRect().top)))
		.toBeLessThan(200);
	await expect(toc(page).locator('[aria-current="location"]')).toHaveText('Zuständigkeiten');
});

test('the table of contents folds away and stays folded', async ({ page }) => {
	await page.goto(`/w/${PATH}`);
	await expect(toc(page)).toBeVisible();

	const toggle = page.locator('[data-page-toc] > button');
	await toggle.click();
	await expect(toc(page)).toHaveCount(0);
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');

	await page.reload();
	await expect(page.locator('[data-page-toc] > button')).toBeVisible();
	await expect(toc(page)).toHaveCount(0);
});

test('while editing, new headings show up right away', async ({ page }) => {
	await page.goto(`/w/${PATH}/edit`);
	await expect(toc(page)).toBeVisible({ timeout: 15_000 });

	await page.locator('.ProseMirror h2', { hasText: 'Abschluss' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('## Nachtrag');

	await expect(toc(page).getByRole('button').last()).toHaveText('Nachtrag');
});

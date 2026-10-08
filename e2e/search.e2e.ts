import { expect, test, type Page } from '@playwright/test';

// Searches the pages seeded by e2e/setup-db.js — which writes them straight
// into the database, so the first search also covers building the index.

async function search(page: Page, query: string) {
	await page.goto(`/suche?q=${encodeURIComponent(query)}`);
	return page.locator('ol li a');
}

test('finds pages by words in their text, with the match highlighted', async ({ page }) => {
	const hits = await search(page, 'Kernarbeitszeiten');
	await expect(hits).toHaveCount(1);
	await expect(hits.first()).toContainText('PDF-Export Prüfseite');
	await expect(hits.first().locator('mark').first()).toHaveText(/^Kernarbeitszeiten$/i);

	await hits.first().click();
	await expect(page).toHaveURL(/\/w\/e2e\/pdf-export$/);
});

test('finds other forms of a German word and ranks title matches', async ({ page }) => {
	// "Zuständigkeit" → "Zuständigkeiten", "Abschnitte" → "Abschnitt 1".
	await expect(await search(page, 'Zuständigkeit')).toContainText(['PDF-Export Prüfseite']);
	await expect(await search(page, 'Abschnitte')).toContainText(['Fließtext Prüfseite']);

	const byTitle = await search(page, 'Prüfseite');
	expect(await byTitle.count()).toBeGreaterThanOrEqual(5);
});

test('needs every word, and ignores diagram sources', async ({ page }) => {
	await expect(await search(page, 'Kernarbeitszeiten Umlauten')).toHaveCount(1);
	await expect(await search(page, 'Kernarbeitszeiten Quokka')).toHaveCount(0);
	await expect(page.getByText('Keine Seite enthält')).toBeVisible();

	// BPMN XML and Excalidraw JSON aren't text anyone searches for.
	await expect(await search(page, 'sequenceFlow')).toHaveCount(0);
});

test('saved and deleted pages are found or gone right away', async ({ page, baseURL }) => {
	const path = 'e2e/suche-neu';
	const form = (data: Record<string, string>) => ({
		form: data,
		headers: { origin: baseURL! },
		maxRedirects: 0
	});

	await page.request.post(
		`/w/${path}/edit?/save`,
		form({ title: 'Neue Suchseite', content: 'Hier wohnt der Quokkaflüsterer.' })
	);
	await expect(await search(page, 'Quokkaflüsterer')).toContainText(['Neue Suchseite']);

	// A new version replaces the old text in the index.
	await page.request.post(
		`/w/${path}/edit?/save`,
		form({ title: 'Neue Suchseite', content: 'Jetzt wohnt hier jemand anderes.', baseVersion: '1' })
	);
	await expect(await search(page, 'Quokkaflüsterer')).toHaveCount(0);

	await page.request.post(`/w/${path}/edit?/delete`, form({}));
	await expect(await search(page, 'jemand anderes')).toHaveCount(0);
});

test('the search field in the header leads to the results', async ({ page }) => {
	await page.goto('/w/e2e/long-text');
	const field = page.getByRole('searchbox', { name: 'Wiki durchsuchen' });
	await field.fill('Kernarbeitszeiten');
	await field.press('Enter');
	await expect(page).toHaveURL(/\/suche\?q=Kernarbeitszeiten/);
	await expect(page.getByRole('status')).toHaveText('1 Seite gefunden');
});

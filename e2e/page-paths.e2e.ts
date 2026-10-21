import { expect, test } from '@playwright/test';
import { onPage } from './helpers';

test('a new page opened under a raw name moves to its canonical path', async ({ page }) => {
	await page.goto('/w/Personal/Neue Kündigung/edit');
	await expect(page).toHaveURL(
		/\/w\/personal\/neue-kuendigung\/edit\?title=Neue%20K%C3%BCndigung$/
	);
	await expect(onPage(page, 'h1')).toHaveText('Neue Kündigung');
});

test('saving a page under a non-canonical path is refused', async ({ page, baseURL }) => {
	const response = await page.request.post(`/w/${encodeURIComponent('Rohe Seite')}/edit?/save`, {
		form: { title: 'Rohe Seite', content: 'x' },
		headers: { origin: baseURL!, accept: 'application/json' },
		maxRedirects: 0
	});
	expect(await response.text()).toContain('Ungültiger Seitenpfad');

	const view = await page.request.get(`/w/${encodeURIComponent('Rohe Seite')}`);
	expect(view.status()).toBe(404);
});

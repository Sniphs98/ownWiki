import { expect, test } from '@playwright/test';

// The default server (AUTH_MODE=disabled).

test('tags are set while editing, shown on the page and gathered under /tags', async ({
	page,
	request,
	baseURL
}) => {
	const id = Date.now().toString(36);
	const path = `e2e/tags-${id}`;
	const tag = `prozess-${id}`;

	await page.goto(`/w/${path}/edit?title=${encodeURIComponent(`Getaggt ${id}`)}`);
	await page.getByRole('textbox', { name: 'Tags' }).fill(`HR, Prozess ${id}, hr`);
	await page.getByRole('button', { name: 'Speichern' }).click();
	await expect(page).toHaveURL(new RegExp(`/w/${path}$`));

	const tags = page.getByRole('list', { name: 'Tags' }).getByRole('link');
	await expect(tags).toHaveText(['#hr', `#${tag}`]);

	await tags.last().click();
	await expect(page).toHaveURL(new RegExp(`/tags/${tag}$`));
	await expect(page.getByRole('heading', { name: `#${tag}` })).toBeVisible();
	await page
		.getByRole('main')
		.getByRole('link', { name: new RegExp(`Getaggt ${id}`) })
		.click();
	await expect(page).toHaveURL(new RegExp(`/w/${path}$`));

	await page.goto('/tags');
	await expect(page.getByRole('link', { name: `#${tag} 1` })).toBeVisible();

	// A save without the field (e.g. from an older form) keeps the tags.
	const saved = await request.post(`/w/${path}/edit?/save`, {
		form: { content: `# Getaggt ${id}\n\nMehr Text.`, baseVersion: '1' },
		headers: { origin: baseURL!, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(saved.status()).toBe(303);
	await page.goto(`/w/${path}`);
	await expect(tags).toHaveText(['#hr', `#${tag}`]);

	// Emptied in the editor, they're gone.
	await page.goto(`/w/${path}/edit`);
	await expect(page.getByRole('textbox', { name: 'Tags' })).toHaveValue(`hr, ${tag}`);
	await page.getByRole('textbox', { name: 'Tags' }).fill('');
	await page.getByRole('button', { name: 'Speichern' }).click();
	await expect(page).toHaveURL(new RegExp(`/w/${path}$`));
	await expect(page.getByRole('list', { name: 'Tags' })).toHaveCount(0);
});

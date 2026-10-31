import { expect, test } from '@playwright/test';
import { createPage, openEditor, type } from './helpers';

// The default server (AUTH_MODE=disabled).

const longText = Array.from(
	{ length: 60 },
	(_, i) => `Absatz ${i + 1}: ein Satz, damit die Seite länger als das Fenster wird.`
).join('\n\n');

test('on a long page, saving is at hand without scrolling to the end', async ({
	page,
	baseURL
}) => {
	const path = await createPage(page, baseURL!, 'lang', `# Lang\n\n${longText}`);
	await page.goto(`/w/${path}/edit`);

	const save = page.getByRole('button', { name: 'Speichern', exact: true });
	await expect(save).toBeInViewport();
	await expect(page.getByRole('link', { name: 'Abbrechen' })).toBeInViewport();
	// The end of the text is far below.
	await expect(page.getByText('Absatz 60:')).not.toBeInViewport();
});

test('Ctrl+S saves', async ({ page, baseURL }) => {
	const path = await createPage(page, baseURL!, 'tastatur', '# Tastatur\n\nStart.');
	await openEditor(page, path);
	await type(page, ' Mit Strg+S gespeichert.');
	await page.keyboard.press('Control+s');
	await page.waitForURL(`**/w/${path}`);
	await expect(page.getByText('Start. Mit Strg+S gespeichert.')).toBeVisible();
});

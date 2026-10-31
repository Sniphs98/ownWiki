import { expect, test, type Page } from '@playwright/test';
import { markdown, onPage, press, save, startEditing, type } from './helpers';

// Typing `[[` in the editor suggests pages to link. The default server,
// with the pages from e2e/setup-db.js ("Betrieb", "Einrichtung" …).
test.describe.configure({ mode: 'parallel' });

const expectMarkdown = (page: Page, expected: string) =>
	expect.poll(() => markdown(page).inputValue()).toContain(expected);

const suggestion = (page: Page, name: string | RegExp) => page.getByRole('option', { name });

/** A page titled by its heading, returning its path. */
async function pageTitled(page: Page, baseURL: string, slug: string, title: string) {
	const path = `e2e/${slug}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
	const response = await page.request.post(`${baseURL}/w/${path}/edit?/save`, {
		form: { content: `# ${title}\n\nText.` },
		headers: { origin: baseURL, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
	return path;
}

// Milkdown stores a typed `[[` escaped.
const link = (text: string) => `\\[\\[${text}]]`;

test('typing [[ suggests pages, and Enter links the highlighted one', async ({ page, baseURL }) => {
	const path = await startEditing(page, baseURL!, 'Start.');
	await type(page, ' Siehe [[Betri');
	await expect(suggestion(page, /Betrieb/)).toBeVisible();
	await press(page, 'Enter');
	await expect(suggestion(page, /Betrieb/)).toHaveCount(0);
	await expectMarkdown(page, link('Betrieb'));

	await save(page, path);
	await expect(page.getByRole('main').getByRole('link', { name: 'Betrieb' })).toHaveAttribute(
		'href',
		'/w/e2e/handbuch/betrieb'
	);
});

test('the arrow keys pick another suggestion, Escape closes them', async ({ page, baseURL }) => {
	const id = Date.now().toString(36);
	await pageTitled(page, baseURL!, 'pfeil-a', `Pfeil A ${id}`);
	await pageTitled(page, baseURL!, 'pfeil-b', `Pfeil B ${id}`);
	await startEditing(page, baseURL!, 'Start.');

	await type(page, ' [[Pfeil ');
	await expect(suggestion(page, new RegExp(`Pfeil A ${id}`))).toBeVisible();
	await press(page, 'ArrowDown', 'Enter');
	await expectMarkdown(page, link(`Pfeil B ${id}`));

	// Escape: no suggestions, and Enter makes a new paragraph again.
	await type(page, ' [[Pfeil');
	await expect(suggestion(page, new RegExp(`Pfeil A ${id}`))).toBeVisible();
	await press(page, 'Escape');
	await expect(suggestion(page, new RegExp(`Pfeil A ${id}`))).toHaveCount(0);
	await press(page, 'Enter');
	await type(page, 'Neuer Absatz');
	await expect(onPage(page, 'p').last()).toHaveText('Neuer Absatz');
});

test('a name no page has yet is linked as a new page', async ({ page, baseURL }) => {
	const name = `Quokka ${Date.now().toString(36)}`;
	await startEditing(page, baseURL!, 'Start.');
	await type(page, ` [[${name}`);
	await suggestion(page, `„${name}“ verlinken neue Seite`).click();
	await expectMarkdown(page, link(name));
});

test('of two pages with the same title, the chosen one is linked by its path', async ({
	page,
	baseURL
}) => {
	const title = `Doppelt ${Date.now().toString(36)}`;
	const first = await pageTitled(page, baseURL!, 'doppelt-a', title);
	await pageTitled(page, baseURL!, 'doppelt-b', title);
	await startEditing(page, baseURL!, 'Start.');

	await type(page, ` [[${title}`);
	await suggestion(page, new RegExp(first)).click();
	await expectMarkdown(page, link(`${first}|${title}`));
});

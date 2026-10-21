import { expect, test, type Page } from '@playwright/test';
import {
	afterFocus,
	createPage,
	liveEditor,
	markdown,
	onPage,
	openEditor,
	press,
	retitle,
	startEditing,
	type
} from './helpers';

// Leaving the editor with unsaved changes asks first — and only then.
test.describe.configure({ mode: 'parallel' });

const dialog = (page: Page) => page.getByRole('alertdialog', { name: 'Änderungen verwerfen?' });
/** A page in the sidebar, to leave the editor by. */
const sidebarLink = (page: Page) => page.getByRole('link', { name: 'Handbuch', exact: true });

test('without changes, leaving asks nothing', async ({ page }) => {
	// Pages with tables, code, diagrams and files: what the editor shows
	// is not what was loaded, character for character.
	for (const path of ['e2e/pdf-export', 'e2e/long-code', 'e2e/diagrams', 'e2e/files']) {
		await openEditor(page, path);
		await page.waitForLoadState('networkidle');
		await sidebarLink(page).click();
		await page.waitForURL('**/w/e2e/handbuch');
	}
});

test('with changed text, leaving asks; staying keeps the text, leaving discards it', async ({
	page,
	baseURL
}) => {
	const path = await startEditing(page, baseURL!, 'Start.');
	await type(page, ' Ungespeichert.');

	await sidebarLink(page).click();
	await expect(dialog(page)).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`/w/${path}/edit$`));

	await dialog(page).getByRole('button', { name: 'Weiter bearbeiten' }).click();
	await expect(dialog(page)).toBeHidden();
	await expect(page).toHaveURL(new RegExp(`/w/${path}/edit$`));
	await expect(onPage(page, 'p')).toHaveText('Start. Ungespeichert.');

	await page.getByRole('link', { name: 'Abbrechen' }).click();
	await expect(dialog(page)).toBeVisible();
	await dialog(page).getByRole('button', { name: 'Verwerfen' }).click();
	await page.waitForURL(`**/w/${path}`);
	await expect(onPage(page, 'p')).toHaveText('Start.');
});

test('a changed title counts too, until it is changed back', async ({ page, baseURL }) => {
	const path = await createPage(page, baseURL!, 'titel', '# titel\n\nText.');
	await openEditor(page, path);
	await retitle(page, 'Anderer Titel');
	await page.getByRole('link', { name: 'Abbrechen' }).click();
	await expect(dialog(page)).toBeVisible();
	await dialog(page).getByRole('button', { name: 'Weiter bearbeiten' }).click();

	await retitle(page, 'titel');
	await page.getByRole('link', { name: 'Abbrechen' }).click();
	await page.waitForURL(`**/w/${path}`);
});

test('after undoing every change, leaving asks nothing', async ({ page, baseURL }) => {
	await startEditing(page, baseURL!, 'Start.');
	await type(page, ' weg');
	await press(page, 'Control+z');
	await expect(onPage(page, 'p')).toHaveText('Start.');
	await sidebarLink(page).click();
	await page.waitForURL('**/w/e2e/handbuch');
});

test('saving and deleting leave without asking', async ({ page, baseURL }) => {
	const path = await startEditing(page, baseURL!, 'Start.');
	await type(page, ' Gespeichert.');
	await page.getByRole('button', { name: 'Speichern', exact: true }).click();
	await page.waitForURL(`**/w/${path}`);
	await expect(onPage(page, 'p')).toHaveText('Start. Gespeichert.');

	await openEditor(page, path);
	await type(page, ' Egal.');
	await page.getByRole('button', { name: 'Löschen' }).click();
	await page.getByRole('button', { name: 'Endgültig löschen' }).click();
	await page.waitForURL((url) => url.pathname === '/');
	await expect(dialog(page)).toHaveCount(0);
});

test('a failed save still asks before leaving', async ({ page, baseURL, browser }) => {
	const path = await startEditing(page, baseURL!, 'Start.');
	// Someone else saves meanwhile: this save is refused.
	const other = await browser.newPage();
	await other.request.post(`${baseURL}/w/${path}/edit?/save`, {
		form: { title: 'editor', content: 'Von jemand anderem.', baseVersion: '1' },
		headers: { origin: baseURL!, accept: 'text/html' },
		maxRedirects: 0
	});
	await other.close();

	await type(page, ' Meins.');
	await page.getByRole('button', { name: 'Speichern', exact: true }).click();
	await expect(page.getByText('inzwischen gespeichert')).toBeVisible();
	await sidebarLink(page).click();
	await expect(dialog(page)).toBeVisible();
});

test('the browser’s back button asks too', async ({ page, baseURL }) => {
	const path = await createPage(page, baseURL!, 'zurueck', 'Start.');
	await page.goto(`/w/${path}`);
	await page.getByRole('link', { name: 'Bearbeiten' }).first().click();
	await page.waitForURL(`**/w/${path}/edit`);
	await expect(liveEditor(page)).toHaveAttribute('contenteditable', 'true');
	await liveEditor(page).focus();
	await afterFocus(page);
	await press(page, 'Control+End');
	await type(page, ' Ungespeichert.');

	await page.evaluate(() => history.back());
	await expect(dialog(page)).toBeVisible();
	await expect(page).toHaveURL(new RegExp(`/w/${path}/edit$`));
	await dialog(page).getByRole('button', { name: 'Verwerfen' }).click();
	await page.waitForURL(`**/w/${path}`);
	await expect(onPage(page, 'p')).toHaveText('Start.');
});

test('closing the tab with changes lets the browser ask', async ({ page, baseURL }) => {
	await startEditing(page, baseURL!, 'Start.');
	await type(page, ' Ungespeichert.');
	await expect(markdown(page)).toHaveValue(/Ungespeichert/);

	const asked = page.waitForEvent('dialog');
	await page.close({ runBeforeUnload: true });
	const question = await asked;
	expect(question.type()).toBe('beforeunload');
	await question.accept();
});

test('closing the tab without changes asks nothing', async ({ page, baseURL }) => {
	await startEditing(page, baseURL!, 'Start.');
	let asked = false;
	page.on('dialog', (question) => {
		asked = true;
		return question.accept();
	});
	const closed = page.waitForEvent('close');
	await page.close({ runBeforeUnload: true });
	await closed;
	expect(asked).toBe(false);
});

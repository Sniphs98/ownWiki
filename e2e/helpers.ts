import { expect, type Page } from '@playwright/test';

/**
 * Creates a page through the edit form, as the editor does, and returns
 * its path — a new one each time, so the tests can run again on the same
 * database (retries, --repeat-each).
 */
export async function createPage(page: Page, baseURL: string, name: string, content: string) {
	const path = `e2e/${name}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
	const response = await page.request.post(`${baseURL}/w/${path}/edit?/save`, {
		form: { title: name, content },
		headers: { origin: baseURL, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
	return path;
}

/** The editor itself, not the hidden copy the page-break preview measures. */
export const liveEditor = (page: Page) => page.locator('.ProseMirror:not(.page-break-measure *)');

export const onPage = (page: Page, selector: string) =>
	page.locator(`.ProseMirror:not(.page-break-measure *) ${selector}`);

/** The markdown the edit form saves; follows the editor with a short delay. */
export const markdown = (page: Page) => page.locator('input[name=content]');

/**
 * Waits a frame and a task. The browser reports caret moves
 * (selectionchange) asynchronously and ProseMirror only learns about them
 * then — a person never presses the next key that fast, Playwright does.
 */
const settle = (page: Page) =>
	page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve)))
	);

/** Presses keys one after the other, at a pace the editor can follow. */
export async function press(page: Page, ...keys: string[]) {
	for (const key of keys) {
		await page.keyboard.press(key);
		await settle(page);
	}
}

/**
 * Types like a fast typist. Much faster (under ~30 ms a key), Crepe now
 * and then puts the first letter typed into a new list item at its end.
 */
export async function type(page: Page, text: string) {
	await page.keyboard.type(text, { delay: 30 });
	await settle(page);
}

/**
 * ProseMirror puts its own selection back for a moment after the editor
 * gets focus (20 ms) or is clicked (50 ms). Wait that out before using
 * the keyboard, as a person would anyway.
 */
export const afterFocus = (page: Page) => page.waitForTimeout(100);

/** Opens the editor of `path` with the cursor at the end of the text. */
export async function openEditor(page: Page, path: string) {
	await page.goto(`/w/${path}/edit`);
	const editor = liveEditor(page);
	await expect(editor).toHaveAttribute('contenteditable', 'true', { timeout: 30_000 });
	await editor.focus();
	await afterFocus(page);
	await press(page, 'Control+End');
}

/** Replaces the editor's first line — the heading that is the page's title. */
export async function retitle(page: Page, title: string) {
	await liveEditor(page).focus();
	await afterFocus(page);
	await press(page, 'Control+Home', 'Shift+End');
	await type(page, title);
}

/** Creates a page with `content` and opens its editor, cursor at the end. */
export async function startEditing(page: Page, baseURL: string, content: string, name = 'editor') {
	const path = await createPage(page, baseURL, name, content);
	await openEditor(page, path);
	return path;
}

export async function save(page: Page, path: string) {
	await page.getByRole('button', { name: 'Speichern', exact: true }).click();
	await page.waitForURL(`**/w/${path}`);
}

/** The markdown stored for `path`, as the edit form loads it. */
export async function savedMarkdown(page: Page, path: string) {
	await page.goto(`/w/${path}/edit`);
	return markdown(page).inputValue();
}

/** Pastes like Ctrl+V would, with the given clipboard content. */
export async function paste(page: Page, text: string, html?: string) {
	await page.evaluate(
		([text, html]) => {
			const data = new DataTransfer();
			data.setData('text/plain', text);
			if (html) data.setData('text/html', html);
			const event = new ClipboardEvent('paste', {
				clipboardData: data,
				bubbles: true,
				cancelable: true
			});
			document.activeElement?.dispatchEvent(event);
		},
		[text, html] as const
	);
	await settle(page);
}

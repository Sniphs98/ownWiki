import { expect, test, type Page } from '@playwright/test';
import {
	afterFocus,
	createPage,
	liveEditor,
	markdown,
	onPage,
	paste,
	press,
	save,
	savedMarkdown,
	startEditing,
	type
} from './helpers';

// Writing in the editor is what the wiki is for: typing, the markdown
// shortcuts, moving around with the keyboard, the "/" menu, the toolbar
// and links. Every test edits a page of its own, so they run in parallel.
test.describe.configure({ mode: 'parallel' });

/** Waits for the saved markdown to contain `expected`. */
const expectMarkdown = (page: Page, expected: string) =>
	expect.poll(() => markdown(page).inputValue()).toContain(expected);

test.describe('Schreiben', () => {
	test('typed text is saved exactly as written, markdown characters included', async ({
		page,
		baseURL
	}) => {
		const text = 'Ärger über Öl & <Tags>, $5, 50 %, a * b _ c # [x] \\ ~ Ende';
		const path = await startEditing(page, baseURL!, 'Start.');
		await press(page, 'Enter');
		await type(page, text);
		await expectMarkdown(page, 'Ende');
		await save(page, path);

		await expect(onPage(page, 'p').last()).toHaveText(text);
		// And the editor shows it the same way again.
		await page.goto(`/w/${path}/edit`);
		await expect(onPage(page, 'p').last()).toHaveText(text);
	});

	test('what was typed right before saving is saved too', async ({ page, baseURL }) => {
		const path = await startEditing(page, baseURL!, 'Start.');
		await type(page, ' Zuletzt getippt.');
		// No pause: the save comes before the editor's debounced update.
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await page.waitForURL(`**/w/${path}`);
		expect(await savedMarkdown(page, path)).toContain('Start. Zuletzt getippt.');
	});

	test('Enter splits a paragraph at the cursor, Backspace joins it again', async ({
		page,
		baseURL
	}) => {
		await startEditing(page, baseURL!, 'AbcDef');
		await press(page, 'Home', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'Enter');
		await expect(markdown(page)).toHaveValue('Abc\n\nDef\n');
		await press(page, 'Backspace');
		await expect(markdown(page)).toHaveValue('AbcDef\n');
	});

	test('Ctrl+Z undoes and Ctrl+Shift+Z redoes', async ({ page, baseURL }) => {
		await startEditing(page, baseURL!, 'Start.');
		await type(page, ' eins');
		await press(page, 'Control+z');
		// Back to the text as loaded (Milkdown adds the final line break on its first change).
		await expect(markdown(page)).toHaveValue(/^Start\.\n?$/);
		await press(page, 'Control+Shift+z');
		await expect(markdown(page)).toHaveValue('Start. eins\n');
	});

	test('Ctrl+B and Ctrl+I switch bold and italic on and off', async ({ page, baseURL }) => {
		await startEditing(page, baseURL!, 'Start.');
		await press(page, 'Enter', 'Control+b');
		await type(page, 'fett');
		await press(page, 'Control+b');
		await type(page, ' normal ');
		await press(page, 'Control+i');
		await type(page, 'kursiv');
		await expectMarkdown(page, '**fett** normal *kursiv*');
	});
});

test.describe('Markdown-Kürzel', () => {
	const shortcuts: { name: string; keys: (string | { type: string })[]; expected: string }[] = [
		{ name: 'heading 1', keys: [{ type: '# Titel' }], expected: '\n# Titel\n' },
		{ name: 'heading 2', keys: [{ type: '## Abschnitt' }], expected: '\n## Abschnitt\n' },
		{ name: 'heading 3', keys: [{ type: '### Teil' }], expected: '\n### Teil\n' },
		{ name: 'bullet list', keys: [{ type: '- Punkt' }], expected: '\n* Punkt\n' },
		{ name: 'ordered list', keys: [{ type: '1. Schritt' }], expected: '\n1. Schritt\n' },
		{ name: 'task list', keys: [{ type: '- [ ] Aufgabe' }], expected: '\n* [ ] Aufgabe\n' },
		{ name: 'quote', keys: [{ type: '> Zitat' }], expected: '\n> Zitat\n' },
		{ name: 'divider', keys: [{ type: '---' }], expected: '\n***\n' },
		{
			name: 'code block',
			keys: [{ type: '```bash' }, 'Enter', { type: 'echo hallo' }],
			expected: '\n```bash\necho hallo\n```\n'
		},
		{
			name: 'bold, italic, code, strikethrough',
			keys: [{ type: '**fett** *kursiv* `code` ~~weg~~ Ende' }],
			expected: '\n**fett** *kursiv* `code` ~~weg~~ Ende\n'
		},
		{ name: 'image', keys: [{ type: '![Logo](/logo.png)' }], expected: '![Logo](/logo.png)' },
		{
			name: 'link',
			keys: [{ type: 'Siehe [Beispiel](https://example.org) hier' }],
			expected: '\nSiehe [Beispiel](https://example.org) hier\n'
		},
		{
			name: 'web address',
			keys: [{ type: 'Siehe https://example.org/seite. Ende' }],
			expected: '\nSiehe <https://example.org/seite>. Ende\n'
		}
	];

	for (const { name, keys, expected } of shortcuts) {
		test(name, async ({ page, baseURL }) => {
			await startEditing(page, baseURL!, 'Start.');
			await press(page, 'Enter');
			for (const key of keys) {
				if (typeof key === 'string') await press(page, key);
				else await type(page, key.type);
			}
			await expectMarkdown(page, expected);
		});
	}
});

test.describe('Listen', () => {
	test('Tab indents, Shift+Tab outdents, Enter on an empty item ends the list', async ({
		page,
		baseURL
	}) => {
		await startEditing(page, baseURL!, 'Start.');
		await press(page, 'Enter');
		await type(page, '- a');
		await press(page, 'Enter');
		await type(page, 'b');
		await press(page, 'Enter', 'Tab');
		await type(page, 'c');
		await press(page, 'Enter', 'Shift+Tab');
		await type(page, 'd');
		await press(page, 'Enter', 'Enter');
		await type(page, 'danach');
		await expect(markdown(page)).toHaveValue('Start.\n\n* a\n* b\n\n  * c\n* d\n\ndanach\n\n');
	});

	test('Enter continues a numbered list and a checklist', async ({ page, baseURL }) => {
		await startEditing(page, baseURL!, 'Start.');
		await press(page, 'Enter');
		await type(page, '1. eins');
		await press(page, 'Enter');
		await type(page, 'zwei');
		await press(page, 'Enter', 'Enter');
		await type(page, '- [ ] offen');
		await press(page, 'Enter');
		await type(page, 'auch offen');
		await expectMarkdown(page, '1. eins\n2. zwei\n\n* [ ] offen\n* [ ] auch offen\n');
	});
});

test.describe('Navigieren', () => {
	test('arrow keys move between paragraphs, Home and End within a line', async ({
		page,
		baseURL
	}) => {
		await startEditing(page, baseURL!, 'Eins.\n\nZwei.\n\nDrei.');
		await press(page, 'ArrowUp', 'ArrowUp', 'End');
		await type(page, 'X');
		await press(page, 'ArrowDown', 'Home');
		await type(page, 'Y');
		await press(page, 'Control+Home');
		await type(page, 'A');
		await press(page, 'Control+End');
		await type(page, 'Z');
		await expect(markdown(page)).toHaveValue('AEins.X\n\nYZwei.\n\nDrei.Z\n');
	});

	test('arrow keys move into a code block and out of it again', async ({ page, baseURL }) => {
		await startEditing(page, baseURL!, 'Vor.\n\n```js\nzeile1\nzeile2\n```\n\nNach.');
		// Up from the paragraph below: into the code's last line.
		await press(page, 'ArrowUp');
		await type(page, 'X');
		await expect
			.poll(() => markdown(page).inputValue())
			.toMatch(/```js\nzeile1\n[^\n]*X[^\n]*\n```/);

		// Down out of it again.
		await press(page, 'ArrowDown', 'End');
		await type(page, 'Y');
		await expectMarkdown(page, '```\n\nNach.Y');

		// From the top through the whole code block.
		await press(page, 'Control+Home', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Home');
		await type(page, 'Z');
		await expectMarkdown(page, '```\n\nZNach.Y');
	});

	for (const [name, block] of [
		['code block', '```js\nlet a = 1;\n```'],
		['table', '| a | b |\n| - | - |\n| 1 | 2 |'],
		['divider', '---']
	]) {
		test(`ArrowDown leaves a ${name} at the end of the page`, async ({ page, baseURL }) => {
			await startEditing(page, baseURL!, `Vor.\n\n${block}`);
			// Into the block from the paragraph above, then past its end.
			await press(page, 'Control+Home', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown');
			await type(page, 'Danach');
			await expect.poll(() => markdown(page).inputValue()).toMatch(/\n\nDanach\n+$/);
		});
	}

	test('Tab moves to the next table cell', async ({ page, baseURL }) => {
		await startEditing(page, baseURL!, 'Start.\n\n| a | b |\n| - | - |\n| 1 | 2 |');
		await onPage(page, 'td').first().click();
		await afterFocus(page);
		await press(page, 'End');
		await type(page, 'X');
		await press(page, 'Tab');
		await type(page, 'Y');
		await expectMarkdown(page, '| 1X | Y');
	});
});

test.describe('„/“-Menü', () => {
	const menu = (page: Page) => page.locator('.milkdown-slash-menu[data-show="true"]');
	const item = (page: Page, label: string) =>
		menu(page).locator('.menu-groups li', { has: page.getByText(label, { exact: true }) });
	const highlighted = (page: Page) => menu(page).locator('.menu-groups li.hover');

	async function openMenu(page: Page, baseURL: string) {
		await startEditing(page, baseURL, 'Start.');
		await press(page, 'Enter');
		await type(page, '/');
		await expect(menu(page)).toBeVisible();
	}

	test('typing filters the menu, Escape closes it', async ({ page, baseURL }) => {
		await openMenu(page, baseURL!);
		await type(page, 'über');
		await expect(menu(page).locator('.menu-groups li')).toHaveText(
			[1, 2, 3, 4, 5, 6].map((level) => `Überschrift ${level}`)
		);
		await press(page, 'Escape');
		await expect(menu(page)).toBeHidden();
		await expectMarkdown(page, '/über');
	});

	const items: { label: string; then?: string; expected: string }[] = [
		...[1, 2, 3, 4, 5, 6].map((level) => ({
			label: `Überschrift ${level}`,
			then: 'Titel',
			expected: `\n${'#'.repeat(level)} Titel\n`
		})),
		{ label: 'Zitat', then: 'Gesagt', expected: '\n> Gesagt\n' },
		{ label: 'Trennlinie', expected: '\n***\n' },
		{ label: 'Aufzählung', then: 'Punkt', expected: '\n* Punkt\n' },
		{ label: 'Nummerierte Liste', then: 'Schritt', expected: '\n1. Schritt\n' },
		{ label: 'Checkliste', then: 'Aufgabe', expected: '\n* [ ] Aufgabe\n' },
		{ label: 'Codeblock', then: 'echo hallo', expected: '\n```\necho hallo\n```\n' },
		{ label: 'Tabelle', expected: '| :-' },
		{ label: 'Formel', expected: '$$' },
		{ label: 'Bild', expected: '![' }
	];

	for (const { label, then, expected } of items) {
		test(`„${label}“ inserts what it says`, async ({ page, baseURL }) => {
			await openMenu(page, baseURL!);
			await type(page, label.toLowerCase());
			await expect(highlighted(page)).toHaveText(label);
			await press(page, 'Enter');
			await expect(menu(page)).toBeHidden();
			if (then) await type(page, then);
			await expectMarkdown(page, expected);
			// The "/…" typed to open the menu is gone.
			expect(await markdown(page).inputValue()).not.toContain(`/${label.toLowerCase()}`);
		});
	}

	test('arrow keys move the highlight one item at a time, Enter takes the highlighted one — also with the mouse resting over the menu', async ({
		page,
		baseURL
	}) => {
		await openMenu(page, baseURL!);
		// The mouse rests where the menu opens — the list scrolls below it.
		const box = (await menu(page).boundingBox())!;
		await press(page, 'Backspace');
		await expect(menu(page)).toBeHidden();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.6);
		await type(page, '/');
		await expect(menu(page)).toBeVisible();

		const index = () => highlighted(page).getAttribute('data-index');
		await expect.poll(index).toBe('0');
		for (let i = 1; i <= 14; i++) {
			await press(page, 'ArrowDown');
			await expect.poll(index).toBe(String(i));
		}
		for (let i = 13; i >= 11; i--) {
			await press(page, 'ArrowUp');
			await expect.poll(index).toBe(String(i));
		}
		// The list did scroll under the mouse, the case this is about.
		expect(
			await menu(page)
				.locator('.menu-groups')
				.evaluate((el) => el.scrollTop)
		).toBeGreaterThan(0);

		await expect(highlighted(page)).toHaveText('Checkliste');
		// A moment for anything that would still move the highlight.
		await page.waitForTimeout(300);
		await expect(highlighted(page)).toHaveText('Checkliste');
		await press(page, 'Enter');
		await expectMarkdown(page, '\n* [ ] ');
	});

	test('an item can be picked with the mouse', async ({ page, baseURL }) => {
		await openMenu(page, baseURL!);
		await item(page, 'Zitat').hover();
		await expect(highlighted(page)).toHaveText('Zitat');
		await item(page, 'Zitat').click();
		await type(page, 'Per Maus');
		await expectMarkdown(page, '\n> Per Maus\n');
	});
});

test.describe('Werkzeugleiste', () => {
	const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Formatierung' });

	for (const [button, expected] of [
		['Fett', '**Wort**'],
		['Kursiv', '*Wort*'],
		['Durchgestrichen', '~~Wort~~'],
		['Inline-Code', '`Wort`']
	]) {
		test(`„${button}“ formats the selected text`, async ({ page, baseURL }) => {
			// Not in the first lines: Crepe's own formatting bar pops up above
			// the selection, there it would cover the toolbar.
			await startEditing(page, baseURL!, 'Eins.\n\nZwei.\n\nDrei.\n\nWort');
			await press(page, 'Shift+Home');
			const toggle = toolbar(page).getByRole('button', { name: button });
			await toggle.click();
			await expect(toggle).toHaveAttribute('aria-pressed', 'true');
			await expectMarkdown(page, `\n${expected}\n`);
		});
	}

	for (const [button, expected] of [
		['Aufzählung', '\n* Zeile\n'],
		['Nummerierte Liste', '\n1. Zeile\n'],
		['Checkliste', '\n* [ ] Zeile\n'],
		['Zitat', '\n> Zeile\n'],
		['Codeblock', '\n```\nZeile\n```\n'],
		['Trennlinie', '\n***\n'],
		['Tabelle', '| :-']
	]) {
		test(`„${button}“ works on the current line`, async ({ page, baseURL }) => {
			await startEditing(page, baseURL!, 'Start.\n\nZeile');
			await toolbar(page).getByRole('button', { name: button }).click();
			await expectMarkdown(page, expected);
		});
	}

	test('the paragraph format turns a line into a heading and back', async ({ page, baseURL }) => {
		await startEditing(page, baseURL!, 'Start.\n\nZeile');
		await toolbar(page).getByTitle('Absatzformat').click();
		await page.getByRole('menuitem', { name: 'Überschrift 2' }).click();
		await expectMarkdown(page, '\n## Zeile\n');
		await expect(toolbar(page).getByTitle('Absatzformat')).toContainText('Überschrift 2');

		await toolbar(page).getByTitle('Absatzformat').click();
		await page.getByRole('menuitem', { name: 'Text' }).click();
		await expect(markdown(page)).toHaveValue('Start.\n\nZeile\n');
	});
});

test.describe('Verlinken', () => {
	test('wiki links typed in the editor lead to the page', async ({ page, baseURL }) => {
		const path = await startEditing(page, baseURL!, 'Start.');
		await press(page, 'Enter');
		await type(page, 'Siehe [[Handbuch]] und [[e2e/handbuch|das Handbuch]].');
		await expectMarkdown(page, 'das Handbuch');
		await save(page, path);

		const links = onPage(page, 'a');
		await expect(links).toHaveText(['Handbuch', 'das Handbuch']);
		for (const link of await links.all()) {
			await expect(link).toHaveAttribute('href', '/w/e2e/handbuch');
		}
		await links.last().click();
		await page.waitForURL('**/w/e2e/handbuch');
		await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText('Handbuch');
	});

	test('a wiki link to a heading leads to that heading', async ({ page, baseURL }) => {
		const path = await createPage(page, baseURL!, 'abschnitt-link', '[[Handbuch#Aufbau]]');
		await page.goto(`/w/${path}`);
		const link = onPage(page, 'a');
		await expect(link).toHaveAttribute('href', '/w/e2e/handbuch#aufbau');
		await link.click();
		await page.waitForURL(/\/w\/e2e\/handbuch#aufbau$/);
		// Milkdown gives the heading exactly that id.
		await expect(onPage(page, 'h2#aufbau')).toHaveText('Aufbau');
	});

	test('a wiki link to a missing page creates it', async ({ page, baseURL }) => {
		const name = `Neue Seite ${Date.now().toString(36)}`;
		const path = await createPage(page, baseURL!, 'neue-seite-link', `Zu [[${name}]].`);
		await page.goto(`/w/${path}`);
		await onPage(page, 'a').click();
		await page.waitForURL(/\/edit\?title=/);
		await expect(page.getByLabel('Titel')).toHaveValue(name);
		await page.getByRole('button', { name: 'Speichern', exact: true }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);

		// Back on the first page, the link now leads to the new page itself.
		const created = new URL(page.url()).pathname;
		await page.goto(`/w/${path}`);
		await expect(onPage(page, 'a')).toHaveAttribute('href', created);
	});

	test('links typed as markdown or web address work on the page', async ({ page, baseURL }) => {
		const path = await startEditing(page, baseURL!, 'Start.');
		await press(page, 'Enter');
		await type(page, 'Siehe [Beispiel](https://example.org/a) und https://example.org/b ende');
		await expectMarkdown(page, 'ende');
		await save(page, path);
		await expect(onPage(page, 'a')).toHaveText(['Beispiel', 'https://example.org/b']);
		await expect(onPage(page, 'a').first()).toHaveAttribute('href', 'https://example.org/a');
		await expect(onPage(page, 'a').last()).toHaveAttribute('href', 'https://example.org/b');
	});

	test('the toolbar links the selected text', async ({ page, baseURL }) => {
		await startEditing(page, baseURL!, 'Start.\n\nLinktext');
		await press(page, 'Shift+Home');
		await page
			.getByRole('toolbar', { name: 'Formatierung' })
			.getByRole('button', { name: 'Link' })
			.click();
		await type(page, 'https://example.org/');
		await press(page, 'Enter');
		await expectMarkdown(page, '\n[Linktext](https://example.org/)\n');
	});

	test('a pasted web address becomes a link', async ({ page, baseURL }) => {
		await startEditing(page, baseURL!, 'Start.');
		await press(page, 'Enter');
		await paste(page, 'https://example.org/seite');
		await expectMarkdown(page, '\n<https://example.org/seite>\n');
	});

	test('a web address pasted over selected text links that text', async ({ page, baseURL }) => {
		await startEditing(page, baseURL!, 'Start.\n\nLinktext');
		await press(page, 'Shift+Home');
		await paste(page, 'https://example.org/seite');
		await expectMarkdown(page, '\n[Linktext](https://example.org/seite)\n');
	});

	test('Ctrl+click on a link while editing opens it in a new tab', async ({ page, baseURL }) => {
		const path = await startEditing(page, baseURL!, 'Zum [Handbuch](/w/e2e/handbuch).');
		const opened = page.context().waitForEvent('page');
		await onPage(page, 'a').click({ modifiers: ['Control'] });
		const tab = await opened;
		await tab.waitForURL('**/w/e2e/handbuch');
		await tab.close();
		await expect(page).toHaveURL(new RegExp(`/w/${path}/edit$`));
		await expect(liveEditor(page)).toBeVisible();
	});
});

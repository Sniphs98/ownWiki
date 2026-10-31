import { expect, test, type APIRequestContext } from '@playwright/test';

// The default server (AUTH_MODE=disabled).

async function save(
	request: APIRequestContext,
	baseURL: string,
	path: string,
	content: string,
	baseVersion?: number
) {
	const response = await request.post(`/w/${path}/edit?/save`, {
		form: { content, ...(baseVersion ? { baseVersion: String(baseVersion) } : {}) },
		headers: { origin: baseURL, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
}

test('links keep leading to a renamed page, even when another page takes its old name', async ({
	page,
	request,
	baseURL
}) => {
	const id = Date.now().toString(36);
	const area = `e2e/bindung-${id}`;

	await save(request, baseURL!, `${area}/ziel`, `# Ziel ${id}\n\nText.`);
	await save(
		request,
		baseURL!,
		`${area}/quelle`,
		`# Quelle ${id}\n\nSiehe [[Ziel ${id}]] und [hier](/w/${area}/ziel).`
	);

	// Renamed, and a new page gets the old name.
	await save(request, baseURL!, `${area}/ziel`, `# Neuer Name ${id}\n\nText.`, 1);
	await save(request, baseURL!, `${area}/doppelt`, `# Ziel ${id}\n\nEine andere Seite.`);

	await page.goto(`/w/${area}/quelle`);
	const renamed = page.getByRole('main').getByRole('link', { name: `Neuer Name ${id}` });
	await expect(renamed).toHaveAttribute('href', `/w/${area}/ziel`);
	await expect(page.getByRole('link', { name: 'hier' })).toHaveAttribute('href', `/w/${area}/ziel`);

	// Still a backlink; the newcomer has none.
	await renamed.click();
	await expect(page).toHaveURL(new RegExp(`/w/${area}/ziel$`));
	await expect(
		page.getByRole('region', { name: 'Verlinkt von' }).getByRole('link', { name: `Quelle ${id}` })
	).toBeVisible();
	await page.goto(`/w/${area}/doppelt`);
	await expect(page.getByRole('region', { name: 'Verlinkt von' })).toHaveCount(0);

	// In the editor, the text already uses the new name — saved, it stays bound.
	await page.goto(`/w/${area}/quelle/edit`);
	await expect(page.locator('.milkdown')).toContainText(`Neuer Name ${id}`);
	await page.getByRole('button', { name: 'Speichern' }).click();
	await expect(page).toHaveURL(new RegExp(`/w/${area}/quelle$`));
	await expect(
		page.getByRole('main').getByRole('link', { name: `Neuer Name ${id}` })
	).toHaveAttribute('href', `/w/${area}/ziel`);
});

test('a link to a page that does not exist yet binds once it is created', async ({
	page,
	request,
	baseURL
}) => {
	const id = Date.now().toString(36);
	const area = `e2e/bindung-spaeter-${id}`;

	await save(request, baseURL!, `${area}/quelle`, `# Quelle ${id}\n\nSiehe [[Später ${id}]].`);
	await save(request, baseURL!, `${area}/spaeter`, `# Später ${id}\n\nJetzt da.`);
	// Renamed right away: the link was bound when the page appeared.
	await save(request, baseURL!, `${area}/spaeter`, `# Endlich ${id}\n\nJetzt da.`, 1);

	await page.goto(`/w/${area}/quelle`);
	await expect(page.getByRole('main').getByRole('link', { name: `Endlich ${id}` })).toHaveAttribute(
		'href',
		`/w/${area}/spaeter`
	);
});

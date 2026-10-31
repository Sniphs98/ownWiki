import { expect, test, type APIRequestContext } from '@playwright/test';

// The default server (AUTH_MODE=disabled), with the pages from e2e/setup-db.js.

async function save(request: APIRequestContext, baseURL: string, path: string, content: string) {
	const response = await request.post(`/w/${path}/edit?/save`, {
		form: { content },
		headers: { origin: baseURL, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
}

test('a page lists the pages linking to it, also ones linking before it existed', async ({
	page,
	request,
	baseURL
}) => {
	const id = Date.now().toString(36);
	const target = `e2e/backlinks-${id}/ziel`;

	// Links by title, before the page exists, and by path.
	await save(
		request,
		baseURL!,
		`e2e/backlinks-${id}/frueh`,
		`# Früh ${id}\n\nSiehe [[Ziel ${id}]].`
	);
	await save(request, baseURL!, target, `# Ziel ${id}\n\nHier landen Links.`);
	await save(
		request,
		baseURL!,
		`e2e/backlinks-${id}/pfad`,
		`# Pfad ${id}\n\nSiehe [Ziel](/w/${target}).`
	);
	await save(request, baseURL!, `e2e/backlinks-${id}/ohne`, `# Ohne ${id}\n\n\`[[Ziel ${id}]]\``);

	await page.goto(`/w/${target}`);
	const backlinks = page.getByRole('region', { name: 'Verlinkt von' }).getByRole('link');
	await expect(backlinks).toHaveText([`Früh ${id}`, `Pfad ${id}`]);

	await backlinks.first().click();
	await expect(page).toHaveURL(new RegExp(`/w/e2e/backlinks-${id}/frueh$`));
	// Nothing links here: no section at all.
	await expect(page.getByRole('region', { name: 'Verlinkt von' })).toHaveCount(0);
});

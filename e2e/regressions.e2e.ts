import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test, type Page } from '@playwright/test';

/**
 * Creates a page through the edit form, as the editor does, and returns
 * its path — a new one each time, so the tests can run again on the same
 * database (retries, --repeat-each).
 */
async function createPage(page: Page, baseURL: string, name: string, content: string) {
	const path = `e2e/${name}-${Date.now().toString(36)}`;
	const response = await page.request.post(`${baseURL}/w/${path}/edit?/save`, {
		form: { title: name, content },
		headers: { origin: baseURL, accept: 'text/html' },
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
	return path;
}

/** The editor itself, not the hidden copy the page-break preview measures. */
const onPage = (page: Page, selector: string) =>
	page.locator(`.ProseMirror:not(.page-break-measure *) ${selector}`);

test('the PDF export sends its internal token to no other server', async ({ page, baseURL }) => {
	// A server outside the wiki, e.g. the host of an image a page shows.
	const seen: IncomingHttpHeaders[] = [];
	const outside = createServer((request, response) => {
		seen.push(request.headers);
		response.writeHead(200, { 'content-type': 'image/svg+xml' });
		response.end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
	});
	await new Promise<void>((resolve) => outside.listen(0, '127.0.0.1', resolve));
	const { port } = outside.address() as AddressInfo;

	try {
		const path = await createPage(
			page,
			baseURL!,
			'fremdes-bild',
			`# Fremdes Bild\n\n![Logo](http://127.0.0.1:${port}/logo.svg)\n`
		);
		const pdf = await page.request.get(`/api/pdf/${path}`);
		expect(pdf.status()).toBe(200);

		expect(seen.length).toBeGreaterThan(0);
		for (const headers of seen) expect(headers).not.toHaveProperty('x-internal-pdf-token');
	} finally {
		outside.close();
	}
});

test('files up to the advertised size can be uploaded', async ({ page, baseURL }) => {
	const path = await createPage(page, baseURL!, 'grosse-datei', 'Hier kommt eine große Datei hin.');
	await page.goto(`/w/${path}/edit`, { waitUntil: 'networkidle' });

	await onPage(page, 'p').filter({ hasText: 'Hier kommt eine große Datei hin.' }).click();
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await page.keyboard.type('/');
	const chooser = page.waitForEvent('filechooser');
	await page.getByText('Datei', { exact: true }).click();
	const upload = page.waitForResponse((r) => r.url().endsWith('/api/files'));
	// Far above adapter-node's default body limit (512 KB), below 10 MB.
	await (
		await chooser
	).setFiles({
		name: 'Handbuch.pdf',
		mimeType: 'application/pdf',
		buffer: Buffer.alloc(3 * 1024 * 1024, 1)
	});
	expect((await upload).status()).toBe(200);
	await expect(page.locator('input[name=content]')).toHaveValue(
		/\[Handbuch\.pdf\]\(\/api\/files\//
	);
});

test('wiki link syntax in code stays code', async ({ page, baseURL }) => {
	const path = await createPage(
		page,
		baseURL!,
		'shell-skript',
		[
			'Siehe [[Handbuch]] und `[[Handbuch]]`.',
			'',
			'```bash',
			'if [[ -f "$datei" ]]; then echo da; fi',
			'```',
			''
		].join('\n')
	);
	await page.goto(`/w/${path}`);

	await expect(onPage(page, 'a')).toHaveCount(1);
	await expect(onPage(page, 'a')).toHaveAttribute('href', '/w/e2e/handbuch');
	await expect(onPage(page, 'p code')).toHaveText('[[Handbuch]]');
	await expect(onPage(page, '.cm-content')).toContainText(
		'if [[ -f "$datei" ]]; then echo da; fi',
		{
			timeout: 15_000
		}
	);
});

test('the page tree reveals a page opened through a link', async ({ page, baseURL }) => {
	const path = await createPage(
		page,
		baseURL!,
		'wegweiser',
		'Weiter zum [[e2e/handbuch/betrieb|Betrieb]].'
	);
	await page.goto(`/w/${path}`, { waitUntil: 'networkidle' });
	const entry = page.locator('[data-sidebar="menu-button"]', { hasText: 'Betrieb' });
	// Inside the closed folder "Handbuch".
	await expect(entry).toBeHidden();

	// Client-side navigation, not a fresh page load.
	await onPage(page, 'a').filter({ hasText: 'Betrieb' }).click();
	await page.waitForURL('**/w/e2e/handbuch/betrieb');
	await expect(entry).toBeVisible();
	await expect(entry).toHaveAttribute('data-active', 'true');
});

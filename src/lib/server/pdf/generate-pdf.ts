import { chromium } from 'playwright';
import { env } from '$env/dynamic/private';
import { PDF_INTERNAL_TOKEN, PDF_INTERNAL_TOKEN_HEADER } from './internal-token';

/**
 * Both this generator and the SvelteKit HTTP server it navigates to run in
 * the same process/container, so a loopback URL is always reachable — unlike
 * the app's public origin, which may be unset, or sit behind a proxy/DNS
 * name this container can't resolve to itself.
 */
function internalOrigin(): string {
	const port = env.PORT || '5173';
	// Not 127.0.0.1: some dev setups (e.g. Vite on Windows) bind only the
	// IPv6 loopback (::1), which refuses IPv4 connections outright.
	// "localhost" resolves correctly either way, in dev and in the container.
	return `http://localhost:${port}`;
}

/**
 * Renders the given /print/... path — the same page a user can open
 * directly for a paginated preview — in a headless browser and exports it
 * to PDF. This is what makes the export pixel-accurate to the app: it's the
 * real Milkdown Crepe editor (readonly) laid out by pagedjs, not a
 * reimplementation of the markdown rendering.
 */
export async function generatePdf(printPathAndQuery: string): Promise<Buffer> {
	const url = new URL(printPathAndQuery, internalOrigin());

	const browser = await chromium.launch();
	try {
		const context = await browser.newContext();
		await context.setExtraHTTPHeaders({ [PDF_INTERNAL_TOKEN_HEADER]: PDF_INTERNAL_TOKEN });
		const page = await context.newPage();

		await page.goto(url.toString(), { waitUntil: 'load' });
		await page.waitForSelector('[data-print-ready="true"]', { timeout: 60000 });

		// pagedjs already lays out each page's margins (and its own page-number
		// footer, see the @page rule in print/[...path]/+page.svelte) as real
		// content inside the fixed-size .pagedjs_page boxes, so Chromium just
		// needs to print those boxes as-is with no margin/header-footer of its
		// own layered on top.
		const pdf = await page.pdf({
			printBackground: true,
			preferCSSPageSize: true,
			margin: { top: 0, right: 0, bottom: 0, left: 0 }
		});
		return pdf;
	} finally {
		await browser.close();
	}
}

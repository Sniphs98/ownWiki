import { error } from '@sveltejs/kit';
import { chromium, type Browser } from 'playwright';
import { internalOrigin } from '$lib/server/internal-origin';
import {
	PDF_INTERNAL_TOKEN,
	PDF_INTERNAL_TOKEN_HEADER,
	PDF_INTERNAL_USER_HEADER
} from './internal-token';
import { createLimiter, QueueFullError } from './concurrency';

/** How long the print view may take to render and paginate. */
const PRINT_TIMEOUT_MS = 60_000;

/**
 * Each export renders a whole page in Chromium, which costs a lot of memory
 * and CPU — a handful of parallel requests (anyone can send them in
 * AUTH_MODE=read-only) could otherwise take the server down.
 */
const limitExports = createLimiter(2, 10);

/**
 * One Chromium for all exports, started on first use: launching it takes
 * longer than many exports. Each export gets its own context, so they share
 * no cookies or storage. Relaunched if it crashes.
 */
let sharedBrowser: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
	if (!sharedBrowser) {
		const launching = chromium.launch();
		sharedBrowser = launching;
		launching.then(
			(browser) =>
				browser.on('disconnected', () => {
					if (sharedBrowser === launching) sharedBrowser = null;
				}),
			() => {
				if (sharedBrowser === launching) sharedBrowser = null;
			}
		);
	}
	return sharedBrowser;
}

/**
 * Renders the given /print/... path — the same page a user can open
 * directly for a paginated preview — in a headless browser and exports it
 * to PDF. This is what makes the export pixel-accurate to the app: it's the
 * real Milkdown Crepe editor (readonly) laid out by pagedjs, not a
 * reimplementation of the markdown rendering.
 */
export function generatePdf(
	printPathAndQuery: string,
	requestUrl: URL,
	userId?: string
): Promise<Buffer> {
	const url = new URL(printPathAndQuery, internalOrigin(requestUrl));
	return limitExports(() => renderPdf(url, userId));
}

/** Renders `url` as `userId` would see it — or as a visitor without login. */
async function renderPdf(url: URL, userId?: string): Promise<Buffer> {
	const browser = await getBrowser();
	const context = await browser.newContext();
	try {
		// Only for requests to the wiki itself: a page can show images from
		// anywhere, and whoever has the token gets past the AUTH_MODE gate.
		await context.route(`${url.origin}/**`, (route) =>
			route.continue({
				headers: {
					...route.request().headers(),
					[PDF_INTERNAL_TOKEN_HEADER]: PDF_INTERNAL_TOKEN,
					...(userId ? { [PDF_INTERNAL_USER_HEADER]: userId } : {})
				}
			})
		);
		const page = await context.newPage();

		const response = await page.goto(url.toString(), { waitUntil: 'load' });
		if (!response?.ok()) {
			throw new Error(`Druckansicht ${url.pathname} antwortet mit HTTP ${response?.status()}`);
		}

		// print-preview.svelte sets one of these once it's done — or has given
		// up, so a broken page fails fast instead of running into the timeout.
		await page
			.waitForSelector('[data-print-ready="true"], [data-print-error]', {
				// <body> has no visible content when rendering failed.
				state: 'attached',
				timeout: PRINT_TIMEOUT_MS
			})
			.catch(() => {
				throw new Error(
					`Druckansicht ${url.pathname} wurde nicht innerhalb von ${PRINT_TIMEOUT_MS / 1000} s fertig`
				);
			});
		const printError = await page.evaluate(() => document.body.dataset.printError);
		if (printError) throw new Error(`Druckansicht fehlgeschlagen: ${printError}`);

		// Let a font that finished loading at the last moment reach the
		// rendered layout before it's printed.
		await page.evaluate(async () => {
			await document.fonts.ready;
			await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
		});

		// pagedjs already lays out each page's margins (and its own page-number
		// footer, see the @page rule in print-preview.svelte) as real
		// content inside the fixed-size .pagedjs_page boxes, so Chromium just
		// needs to print those boxes as-is with no margin/header-footer of its
		// own layered on top.
		const pdf = await page.pdf({
			printBackground: true,
			// Bookmarks from the headings (structured in print-toc.ts); the
			// outline is built from the tagged-PDF structure.
			outline: true,
			tagged: true,
			preferCSSPageSize: true,
			margin: { top: 0, right: 0, bottom: 0, left: 0 }
		});
		return pdf;
	} finally {
		await context.close();
	}
}

/**
 * generatePdf for request handlers: logs the cause and answers with a
 * readable 500 instead of SvelteKit's generic "Internal Error".
 */
export async function generatePdfOrFail(
	printPathAndQuery: string,
	requestUrl: URL,
	userId?: string
) {
	try {
		return await generatePdf(printPathAndQuery, requestUrl, userId);
	} catch (cause) {
		if (cause instanceof QueueFullError) {
			error(503, 'Gerade laufen zu viele PDF-Exporte. Bitte versuche es gleich noch einmal.');
		}
		console.error('PDF export failed:', cause);
		const reason = cause instanceof Error ? cause.message : String(cause);
		error(500, `PDF-Export fehlgeschlagen: ${reason}`);
	}
}

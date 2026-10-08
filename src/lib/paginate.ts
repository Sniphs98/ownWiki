import { PRINT_MARGIN_X_MM, PRINT_MARGIN_Y_MM, PRINT_PAGE_SIZE } from '$lib/print-layout';
import { registerPrintHandlers } from '$lib/print-dom';

/**
 * Only the pagination-specific rules (@page, break-*) need to go through
 * pagedjs's polisher — everything else (Crepe's theme, Tailwind) is already
 * applied live by the browser and stays that way. Passing this explicit
 * stylesheet instead of letting pagedjs auto-discover every stylesheet on
 * the page also sidesteps it choking on Tailwind's generated CSS, which uses
 * @media/@container syntax pagedjs's CSS parser doesn't understand.
 */
const PRINT_CSS = `
	@page {
		size: ${PRINT_PAGE_SIZE};
		margin: ${PRINT_MARGIN_Y_MM}mm ${PRINT_MARGIN_X_MM}mm;

		@bottom-center {
			content: counter(page) ' / ' counter(pages);
			font-family: 'Inter Variable', Arial, Helvetica, sans-serif;
			font-size: 8pt;
			color: #999;
		}
	}

	.wiki-chapter { break-before: page; }
	.wiki-chapter:first-child { break-before: avoid; }
	.wiki-cover { text-align: center; padding-top: 30vh; break-after: page; }
	.wiki-cover h1 { font-family: 'Gelasio Variable', Georgia, 'Times New Roman', serif; font-size: 28pt; }
	.wiki-cover p { color: #4f4539; }

	/* Contents page of multi-page exports, see print-toc.ts. */
	.wiki-toc { break-after: page; font-family: 'Open Sans Variable', Arial, sans-serif; color: #1f1b16; }
	.wiki-toc-title { font-family: 'Gelasio Variable', Georgia, serif; font-size: 24pt; font-weight: 400; margin: 0 0 18pt; }
	.wiki-toc ol { list-style: none; margin: 0; padding: 0; }
	.wiki-toc li { break-inside: auto; }
	.wiki-toc a { display: flex; align-items: baseline; padding: 2.5pt 0; color: inherit; text-decoration: none; break-inside: avoid; }
	.wiki-toc a::after { content: target-counter(attr(href url), page); font-variant-numeric: tabular-nums; }
	.wiki-toc-fill { flex: 1; min-width: 1.5em; margin: 0 0.4em; border-bottom: 1px dotted #b8aea4; }
	.wiki-toc-chapter { margin-top: 8pt; }
	.wiki-toc-chapter > a { font-weight: 600; }
	.wiki-toc-level-1 > a { padding-left: 1.2em; }
	.wiki-toc-level-2 > a { padding-left: 2.4em; color: #4f4539; font-size: 0.95em; }

	img, .wiki-diagram { max-width: 100%; break-inside: avoid; }
	/* prosemirror-tables clips tables (overflow: hidden) and wraps them
	   in a horizontal scroll container — pagedjs can't split a clipped
	   box, it moves it whole and leaves an empty page behind. */
	.milkdown .ProseMirror table,
	.milkdown .ProseMirror .tableWrapper,
	.milkdown .milkdown-table-block .table-wrapper { overflow: visible; }
	/* Same for CodeMirror's horizontally scrolling code blocks, so pagedjs
	   can break between code lines (see linearizeCodeBlocks). */
	.milkdown .cm-editor,
	.milkdown .cm-scroller { overflow: visible; }
	table { break-inside: auto; }
	tr { break-inside: avoid; break-after: auto; }
	thead { display: table-header-group; }
	pre, blockquote, li { break-inside: avoid; }
`;

const PRINT_FONTS = [
	'"Inter Variable"',
	'"Open Sans Variable"',
	'"Gelasio Variable"',
	'"Fira Code Variable"'
];

/**
 * pagedjs measures text to decide where pages break — if a web font is
 * still loading at that point, it measures the fallback font and breaks in
 * the wrong places (and Chromium may print the fallback, too).
 * document.fonts.ready alone isn't enough: it only covers fonts the browser
 * has already started loading.
 */
export async function loadPrintFonts() {
	// The sample text pulls in the latin + latin-ext subsets (umlauts, €).
	const sample = 'AaÄäÖöÜüß€';
	await Promise.all(
		PRINT_FONTS.flatMap((family) => [
			document.fonts.load(`400 16px ${family}`, sample),
			document.fonts.load(`700 16px ${family}`, sample),
			document.fonts.load(`italic 400 16px ${family}`, sample)
		])
	);
	await document.fonts.ready;
}

export interface Pagination {
	/** Removes the rendered pages and the styles pagedjs added to <head>. */
	destroy(): void;
}

/**
 * Lays `html` out into A4 pages inside `target`, exactly as the PDF export
 * does. The HTML must come from toPrintableHtml/stripEditorChrome so editor
 * controls don't end up on the pages.
 */
export async function paginate(html: string, target: HTMLElement): Promise<Pagination> {
	await loadPrintFonts();
	const paged = await import('pagedjs');
	registerPrintHandlers(paged);

	const blobUrl = URL.createObjectURL(new Blob([PRINT_CSS], { type: 'text/css' }));
	const previewer = new paged.Previewer();
	try {
		await previewer.preview(html, [blobUrl], target);
	} finally {
		URL.revokeObjectURL(blobUrl);
	}

	return {
		destroy() {
			previewer.chunker.destroy();
			previewer.polisher.destroy();
		}
	};
}

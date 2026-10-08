import { PRINT_MARGIN_Y_MM } from '$lib/print-layout';

/**
 * A page's own PDF title page (pdf-export-dialog.svelte): markdown, laid
 * out on a page of its own and aligned as chosen. The same CSS
 * (.wiki-cover-page in layout.css) aligns it in the dialog's A4 preview and
 * in the PDF.
 */
export interface Cover {
	content: string;
	alignX: CoverAlignX;
	alignY: CoverAlignY;
}

export const COVER_ALIGN_X = ['start', 'center'] as const;
export const COVER_ALIGN_Y = ['start', 'center', 'end'] as const;
export type CoverAlignX = (typeof COVER_ALIGN_X)[number];
export type CoverAlignY = (typeof COVER_ALIGN_Y)[number];

export function coverAlignX(value: unknown): CoverAlignX {
	return COVER_ALIGN_X.includes(value as CoverAlignX) ? (value as CoverAlignX) : 'center';
}

export function coverAlignY(value: unknown): CoverAlignY {
	return COVER_ALIGN_Y.includes(value as CoverAlignY) ? (value as CoverAlignY) : 'center';
}

export const PRINT_PAGE_HEIGHT_MM = 297;

/**
 * Height of the title page's text area: the A4 page minus its top and
 * bottom margin — less a millimetre, so rounding never pushes it onto a
 * second page.
 */
export const COVER_HEIGHT = `${PRINT_PAGE_HEIGHT_MM - 2 * PRINT_MARGIN_Y_MM - 1}mm`;

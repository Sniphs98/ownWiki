/**
 * Single source of truth for the printed page geometry. The PDF's @page
 * rule (print-preview.svelte) and the on-screen page/edit views both derive
 * their text column from these values, so text wraps at exactly the same
 * points on screen and on paper.
 */
export const PRINT_PAGE_SIZE = 'A4';
export const PRINT_PAGE_WIDTH_MM = 210;
export const PRINT_MARGIN_X_MM = 16;
export const PRINT_MARGIN_Y_MM = 20;

/** Width of the text column: A4 width minus left and right page margin. */
export const PRINT_TEXT_WIDTH = `${PRINT_PAGE_WIDTH_MM - 2 * PRINT_MARGIN_X_MM}mm`;

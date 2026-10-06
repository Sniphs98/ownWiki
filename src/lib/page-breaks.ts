import { paginate } from '$lib/paginate';
import { codeLineTop, PRINT_GUTTER_ATTR } from '$lib/code-mirror-print';
import { copyForPrint, REPEATED_HEADER_ATTR, stripEditorChrome } from '$lib/print-dom';

/** Where a PDF page begins, expressed in terms of the live editor DOM. */
export interface PageBreak {
	/** 1-based number of the page that starts here (always >= 2). */
	page: number;
	/** Live element the page starts in. */
	element: Element;
	/**
	 * When the page starts in the middle of `element`'s text (a paragraph
	 * split across pages): the character offset into its textContent where
	 * the new page begins. null when the whole element starts the page.
	 */
	textOffset: number | null;
	/** The first few characters of the new page, for tooltips and tests. */
	startText: string;
	/**
	 * When the page starts inside a code block: its live .cm-editor and the
	 * 0-based line. CodeMirror may not render that line on screen right now,
	 * so `element` can't be used to place the marker.
	 */
	codeLine: { editor: Element; index: number } | null;
}

/** Links each copied element back to its live counterpart. */
const SOURCE_ATTR = 'data-break-source';
/** 0-based index of a copied code line within its code block. */
const CODE_LINE_ATTR = 'data-code-line';

/**
 * Lays out the given page header and editor exactly as the PDF export would
 * (same CSS, same width, same pagedjs run) inside the off-screen `target`,
 * and reports where each page after the first begins.
 *
 * Works on a copy; the live editor DOM is never modified — ProseMirror
 * would treat changed attributes on its nodes as user edits.
 */
export async function measurePageBreaks(
	header: HTMLElement,
	editorRoot: HTMLElement,
	target: HTMLElement
): Promise<PageBreak[]> {
	let liveElements: Element[] = [];
	const copy = copyForPrint(editorRoot, (copy) => {
		// A deep clone has the same element order, so index i in the copy is
		// the copy of liveElements[i].
		liveElements = [...editorRoot.querySelectorAll('*')];
		copy.querySelectorAll('*').forEach((el, i) => el.setAttribute(SOURCE_ATTR, String(i)));
		for (const content of copy.querySelectorAll('.cm-content')) {
			content
				.querySelectorAll(':scope > .cm-line')
				.forEach((line, index) => line.setAttribute(CODE_LINE_ATTR, String(index)));
		}
	});
	stripEditorChrome(copy);

	// Same structure as one chapter of the print view (print-preview.svelte).
	const html = `<div class="wiki-chapter">${header.outerHTML}${copy.outerHTML}</div>`;

	const pagination = await paginate(html, target);
	try {
		const breaks: PageBreak[] = [];
		const sheets = target.querySelectorAll('.pagedjs_page');
		for (let i = 1; i < sheets.length; i++) {
			const content = sheets[i].querySelector('.pagedjs_page_content');
			const start = content && findPageStart(content);
			if (!start) continue;

			const element = liveElements[Number(start.copy.getAttribute(SOURCE_ATTR))];
			if (!element) continue;

			let codeLine: PageBreak['codeLine'] = null;
			if (start.copy.classList.contains('cm-line')) {
				const copyEditor = start.copy.closest('.cm-editor');
				const editor = liveElements[Number(copyEditor?.getAttribute(SOURCE_ATTR))];
				const index = Number(start.copy.getAttribute(CODE_LINE_ATTR));
				if (editor && !Number.isNaN(index)) codeLine = { editor, index };
			}

			// pagedjs carries the rest of a split element's text over to the
			// next page, so the length difference is where the page begins.
			const textOffset = start.splitText
				? Math.max(0, (element.textContent ?? '').length - (start.copy.textContent ?? '').length)
				: null;
			// The copy, not the live element: it has no editor controls (e.g. a
			// diagram's "Bearbeiten" button). Only a split paragraph needs the
			// live text, as the offset is counted there.
			const text =
				textOffset === null
					? (start.copy.textContent ?? '')
					: (element.textContent ?? '').slice(textOffset);
			const startText = text.trim().slice(0, 40);
			breaks.push({ page: i + 1, element, textOffset, startText, codeLine });
		}
		return breaks;
	} finally {
		pagination.destroy();
	}
}

/**
 * Finds the first piece of content on a paginated page. pagedjs rebuilds
 * the ancestors of continued content as empty shells marked
 * data-split-from; descend through those to the first element that either
 * starts fresh on this page, or is itself continued mid-text.
 */
function findPageStart(content: Element): { copy: Element; splitText: boolean } | null {
	let node: Element = content;
	for (;;) {
		const child = [...node.children].find(
			(el) =>
				!el.hasAttribute(REPEATED_HEADER_ATTR) &&
				!el.hasAttribute(PRINT_GUTTER_ATTR) &&
				hasVisibleContent(el)
		);
		if (!child) return null;

		const isCopy = child.hasAttribute(SOURCE_ATTR);
		const isContinued = child.hasAttribute('data-split-from');

		if (isCopy && !isContinued) return { copy: child, splitText: false };
		if (isCopy && startsWithText(child)) return { copy: child, splitText: true };
		node = child;
	}
}

/** Text, or graphics without text — a diagram or image can start a page too. */
const GRAPHICS = 'svg, img, canvas, video, hr';

function hasVisibleContent(el: Element): boolean {
	return !!el.textContent?.trim() || el.matches(GRAPHICS) || !!el.querySelector(GRAPHICS);
}

function startsWithText(el: Element): boolean {
	for (const node of el.childNodes) {
		if (node.nodeType === Node.TEXT_NODE) {
			if (node.textContent?.trim()) return true;
			continue;
		}
		return false;
	}
	return false;
}

/**
 * Viewport y coordinate (top) of the line a break starts on, or null if
 * the element is no longer in the document (the editor re-rendered it).
 */
export function breakTop(pageBreak: PageBreak): number | null {
	const { element, textOffset, codeLine } = pageBreak;
	if (codeLine)
		return codeLine.editor.isConnected ? codeLineTop(codeLine.editor, codeLine.index) : null;
	if (!element.isConnected) return null;

	if (textOffset !== null) {
		const top = textOffsetTop(element, textOffset);
		if (top !== null) return top;
	}

	// Halfway into the gap above the element, so the line sits between the
	// last content of the previous page and this one.
	const marginTop = parseFloat(getComputedStyle(element).marginTop) || 0;
	return element.getBoundingClientRect().top - marginTop / 2;
}

function textOffsetTop(element: Element, offset: number): number | null {
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	let remaining = offset;
	for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
		if (remaining < node.length) {
			// Skip whitespace: the line pagedjs breaks at may begin with the
			// space after the previous line's last word.
			while (remaining < node.length - 1 && /\s/.test(node.data[remaining])) remaining++;
			const range = document.createRange();
			range.setStart(node, remaining);
			range.setEnd(node, remaining + 1);
			const rect = range.getClientRects()[0];
			if (!rect) return null;
			// The glyph box is shorter than the line box; move up by the half
			// leading so the marker sits exactly between the two lines.
			const lineHeight = parseFloat(getComputedStyle(node.parentElement ?? element).lineHeight);
			const halfLeading = Number.isNaN(lineHeight) ? 0 : (lineHeight - rect.height) / 2;
			return rect.top - Math.max(0, halfLeading);
		}
		remaining -= node.length;
	}
	return null;
}

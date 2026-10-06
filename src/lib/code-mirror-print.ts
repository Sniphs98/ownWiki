import { EditorView } from '@codemirror/view';

/**
 * CodeMirror only renders the lines near the visible part of the window
 * (the rest is an empty "gap" element) and only measures line heights while
 * on screen — so a copy of an off-screen or long code block would be
 * missing lines and have misaligned line numbers.
 *
 * CodeMirror switches this off for the browser's own print dialog
 * (`viewState.printing`, set on the "print" media query). Do the same, so
 * every code block under `root` renders and measures all of its lines.
 * Returns a function that restores normal rendering.
 */
export function renderAllCodeLines(root: Element): () => void {
	const views: PrintableView[] = [];
	for (const dom of root.querySelectorAll<HTMLElement>('.cm-editor')) {
		// Hidden behind a preview (diagrams): never printed, see print-dom.ts.
		if (dom.closest('.codemirror-host.hidden')) continue;
		const view = EditorView.findFromDOM(dom) as PrintableView | null;
		if (!view?.viewState) continue;
		view.viewState.printing = true;
		view.measure();
		views.push(view);
	}

	return () => {
		for (const view of views) {
			view.viewState.printing = false;
			view.requestMeasure();
		}
	};
}

/**
 * viewState and the synchronous measure() are internal to CodeMirror
 * (checked at 6.43) — this mirrors what its own onPrint handler does.
 */
type PrintableView = EditorView & {
	viewState: { printing: boolean };
	measure(): void;
};

/** Marks the line-number cells linearizeCodeBlocks adds to each code line. */
export const PRINT_GUTTER_ATTR = 'data-print-gutter';

/**
 * CodeMirror lays a code block out as two side-by-side columns — all line
 * numbers, then all lines — in a flex container. pagedjs can't split that:
 * it flowed the whole number column across pages first, then the code.
 *
 * Rebuild each code block in `copy` as one row per line (number cell +
 * line), so pagedjs can break between any two lines. The number cells get
 * the live gutter's exact width, so the code doesn't move. `live` must be
 * the element `copy` was cloned from, fully rendered (renderAllCodeLines).
 */
export function linearizeCodeBlocks(live: Element, copy: Element) {
	const liveEditors = live.querySelectorAll('.cm-editor');
	copy.querySelectorAll('.cm-editor').forEach((editor, i) => {
		const gutters = editor.querySelector<HTMLElement>('.cm-gutters');
		const content = editor.querySelector('.cm-content');
		if (!gutters || !content) return;

		const gutterWidth = liveEditors[i]?.querySelector('.cm-gutters')?.getBoundingClientRect().width;
		// The first gutter element is CodeMirror's invisible width spacer.
		const numbers = [...gutters.querySelectorAll<HTMLElement>('.cm-lineNumbers .cm-gutterElement')]
			.filter((el) => el.style.visibility !== 'hidden')
			.map((el) => el.textContent ?? '');

		[...content.querySelectorAll(':scope > .cm-line')].forEach((line, j) => {
			const cell = document.createElement('div');
			cell.className = 'cm-gutters';
			cell.setAttribute(PRINT_GUTTER_ATTR, '');
			cell.style.cssText = `position: static; flex: none; min-height: 0; width: ${gutterWidth}px`;
			cell.innerHTML = '<div class="cm-gutter cm-lineNumbers" style="flex: 1"></div>';
			const number = document.createElement('div');
			number.className = 'cm-gutterElement';
			number.textContent = numbers[j] ?? '';
			cell.firstElementChild!.append(number);

			const row = document.createElement('div');
			row.style.display = 'flex';
			line.replaceWith(row);
			(line as HTMLElement).style.flex = '1';
			row.append(cell, line);
		});

		gutters.remove();
	});
}

/**
 * Viewport y of the top of line `index` (0-based) of a live code block —
 * exact even if CodeMirror isn't currently rendering that line.
 */
export function codeLineTop(editorDom: Element, index: number): number | null {
	const view = EditorView.findFromDOM(editorDom as HTMLElement);
	if (!view || index >= view.state.doc.lines) return null;
	const line = view.state.doc.line(index + 1);
	return view.documentTop + view.lineBlockAt(line.from).top;
}

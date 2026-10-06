/**
 * Crepe renders interactive editor chrome next to the actual content even
 * when readonly: floating menus/toolbars beside the ProseMirror root, table
 * row/column drag handles, and a hidden full copy of every table used as a
 * drag preview. pagedjs would paginate all of that like normal content —
 * the hidden table copy alone was enough to push a real table onto its own
 * page and leave an empty page behind — so strip it from the copy that gets
 * paginated. The live editor is left untouched.
 */
const EDITOR_CHROME_SELECTORS = [
	// Menus, toolbars, tooltips and the block handle rendered as siblings of
	// the ProseMirror root.
	'.milkdown > :not(.ProseMirror)',
	// Decoration widgets (e.g. the virtual cursor) inside the document.
	'.ProseMirror-widget',
	// Table controls and the hidden drag-preview copy of the table.
	'.milkdown-table-block .handle',
	'.milkdown-table-block .drag-preview',
	'.milkdown-table-block .cell-handle',
	'.milkdown-table-block .line-handle'
];

/**
 * prosemirror-tables puts the header row into <tbody> as a row of <th>
 * cells. Moving it into a real <thead> lets the browser/pagedjs treat it as
 * a header — and lets RepeatTableHeaders below repeat it after page breaks.
 */
function promoteHeaderRows(root: HTMLElement) {
	for (const table of root.querySelectorAll('table')) {
		if (table.tHead) continue;
		const firstRow = table.rows[0];
		if (!firstRow || firstRow.cells.length === 0) continue;
		if (![...firstRow.cells].every((cell) => cell.tagName === 'TH')) continue;

		const thead = table.createTHead();
		thead.appendChild(firstRow);
	}
}

/** Returns the HTML of `source` with all editor-only chrome removed. */
export function toPrintableHtml(source: HTMLElement): string {
	const copy = source.cloneNode(true) as HTMLElement;

	for (const el of copy.querySelectorAll(EDITOR_CHROME_SELECTORS.join(','))) el.remove();
	for (const el of copy.querySelectorAll('[contenteditable], [draggable]')) {
		el.removeAttribute('contenteditable');
		el.removeAttribute('draggable');
	}
	promoteHeaderRows(copy);

	return copy.innerHTML;
}

type PagedModule = typeof import('pagedjs');

let handlersRegistered = false;

/**
 * pagedjs repeats nothing of a table when it continues on the next page —
 * it only rebuilds empty <table>/<tbody> shells around the next row. This
 * hook copies the original <thead> into that rebuilt table as soon as its
 * first row is rendered, i.e. before pagedjs measures the page for overflow,
 * so the repeated header's height is accounted for.
 *
 * pagedjs keeps handlers in a global registry, so this registers once.
 */
export function registerPrintHandlers({ Handler, registerHandlers }: PagedModule) {
	if (handlersRegistered) return;
	handlersRegistered = true;

	class RepeatTableHeaders extends Handler {
		renderNode(clone: Node, node: Node) {
			if (!(clone instanceof HTMLTableRowElement) || !(node instanceof HTMLTableRowElement)) return;

			const table = clone.closest('table');
			if (!table || !table.hasAttribute('data-split-from') || table.tHead) return;

			const sourceHead = node.closest('table')?.tHead;
			if (!sourceHead || sourceHead.contains(node)) return;

			const header = sourceHead.cloneNode(true) as HTMLTableSectionElement;
			// pagedjs looks rendered nodes up by data-ref — the copy must not
			// shadow the original header's refs.
			for (const el of [header, ...header.querySelectorAll('[data-ref]')]) {
				el.removeAttribute('data-ref');
			}
			table.insertBefore(header, table.firstChild);
		}
	}

	registerHandlers(RepeatTableHeaders);
}

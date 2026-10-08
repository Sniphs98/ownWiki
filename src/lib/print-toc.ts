/**
 * Table of contents for the PDF, in two forms:
 *
 * - Bookmarks (the PDF viewer's outline): Chromium builds them from the
 *   headings (generate-pdf.ts, `outline: true`), honoring aria-level and
 *   skipping role="presentation". structureHeadings() sets those so each
 *   page's title is a top-level bookmark with its sections nested below —
 *   without changing how anything looks.
 * - A printed contents page after the cover, when asked for (the
 *   "Inhaltsverzeichnis" checkbox), with page numbers filled in by pagedjs
 *   (target-counter, see paginate.ts).
 *
 * Both work on the copy that gets paginated (print-dom.ts), never on the
 * live editors.
 */

const CONTENT_HEADINGS = '.ProseMirror > :is(h1, h2, h3, h4, h5, h6)';

function chapterTitle(chapter: Element): string {
	return chapter.querySelector('.wiki-page-header h1')?.textContent?.trim() ?? '';
}

/** Nests each page's headings below its title, for the PDF bookmarks. */
export function structureHeadings(root: HTMLElement) {
	// The cover's headings aren't sections of their own.
	for (const heading of root.querySelectorAll('.wiki-cover :is(h1, h2, h3, h4, h5, h6)')) {
		heading.setAttribute('role', 'presentation');
	}

	for (const chapter of root.querySelectorAll('.wiki-chapter')) {
		const title = chapterTitle(chapter);
		for (const heading of chapter.querySelectorAll(CONTENT_HEADINGS)) {
			// Pages often start with their title again as a heading.
			if (heading.textContent?.trim() === title) {
				heading.setAttribute('role', 'presentation');
				continue;
			}
			heading.setAttribute('aria-level', String(Number(heading.tagName[1]) + 1));
		}
	}
}

/** Headings deeper than this stay out of the printed contents page. */
const PRINTED_DEPTH = 2;

function entry(text: string, targetId: string, className: string): HTMLLIElement {
	const item = document.createElement('li');
	item.className = className;
	const link = document.createElement('a');
	link.href = `#${targetId}`;
	const label = document.createElement('span');
	label.className = 'wiki-toc-text';
	label.textContent = text;
	const fill = document.createElement('span');
	fill.className = 'wiki-toc-fill';
	// The page number comes from CSS: a::after { content: target-counter(…) }.
	link.append(label, fill);
	item.append(link);
	return item;
}

/**
 * Inserts a contents page after the cover: every page, with its first two
 * levels of headings, linked and with page numbers.
 */
export function addTableOfContents(root: HTMLElement) {
	const chapters = [...root.querySelectorAll<HTMLElement>(':scope > .wiki-chapter')];
	if (chapters.length === 0) return;

	const list = document.createElement('ol');
	chapters.forEach((chapter, c) => {
		chapter.id = `toc-${c}`;
		const title = chapterTitle(chapter);
		const item = entry(title, chapter.id, 'wiki-toc-chapter');

		const sections = document.createElement('ol');
		chapter.querySelectorAll<HTMLElement>(CONTENT_HEADINGS).forEach((heading, h) => {
			const level = Number(heading.tagName[1]);
			const text = heading.textContent?.trim() ?? '';
			if (level > PRINTED_DEPTH || !text || text === title) return;
			heading.id = `toc-${c}-${h}`;
			sections.append(entry(text, heading.id, `wiki-toc-level-${level}`));
		});
		if (sections.children.length > 0) item.append(sections);
		list.append(item);
	});

	const toc = document.createElement('nav');
	toc.className = 'wiki-toc';
	const heading = document.createElement('h1');
	heading.className = 'wiki-toc-title';
	heading.textContent = 'Inhalt';
	heading.setAttribute('role', 'presentation');
	toc.append(heading, list);

	const cover = root.querySelector(':scope > .wiki-cover');
	if (cover) cover.after(toc);
	else chapters[0].before(toc);
}

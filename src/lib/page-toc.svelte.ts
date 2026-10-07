import { browser } from '$app/environment';

export interface TocEntry {
	/** 1–4, from the heading's tag. */
	level: number;
	text: string;
	element: HTMLElement;
}

const EXPANDED_KEY = 'toc-expanded';

/** How far below the top of the content area a heading counts as "current". */
const ACTIVE_OFFSET = 96;

/**
 * The table of contents of the page that's open: the editor showing it
 * (markdown-editor.svelte, given a `tocPath`) publishes its headings here;
 * the page tree (page-toc.svelte) and the panel beside the text
 * (page-toc-aside.svelte) show them, and share which one is current.
 */
class PageToc {
	/** Wiki path of the page the entries belong to, or null. */
	path = $state<string | null>(null);
	entries = $state.raw<TocEntry[]>([]);
	/** The heading whose section is in view, or -1 above the first one. */
	activeIndex = $state(-1);
	/** Whether the table of contents is unfolded in the page tree. Per browser. */
	expanded = $state(true);

	// The heading last jumped to. Near the end of a page it can't scroll up
	// to the top, so the scroll position alone would point at an earlier one.
	#jumpedTo = -1;

	constructor() {
		if (!browser) return;
		try {
			this.expanded = localStorage.getItem(EXPANDED_KEY) !== 'false';
		} catch {
			// Storage blocked — keep the default.
		}
	}

	set(path: string, entries: TocEntry[]) {
		this.path = path;
		this.entries = entries;
	}

	/** Clears the entries if they still belong to `path`. */
	clear(path: string) {
		if (this.path !== path) return;
		this.path = null;
		this.entries = [];
		this.activeIndex = -1;
	}

	toggle() {
		this.expanded = !this.expanded;
		try {
			localStorage.setItem(EXPANDED_KEY, String(this.expanded));
		} catch {
			// Not persisted; still applies until reload.
		}
	}

	/** Scrolls to a heading and marks it current. */
	jumpTo(index: number) {
		const entry = this.entries[index];
		if (!entry) return;
		this.#jumpedTo = index;
		this.activeIndex = index;
		entry.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	/**
	 * Keeps activeIndex in step with what's scrolled into view in
	 * `scroller` (the app's content area). Returns a cleanup function.
	 */
	track(scroller: Element): () => void {
		let frame = 0;
		const update = () => {
			frame = 0;
			const bounds = scroller.getBoundingClientRect();
			let index = -1;
			this.entries.forEach((entry, i) => {
				const { top } = entry.element.getBoundingClientRect();
				if (entry.element.isConnected && top <= bounds.top + ACTIVE_OFFSET) index = i;
			});
			const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2;
			const jumped = this.entries[this.#jumpedTo]?.element;
			if (atBottom && jumped?.isConnected && jumped.getBoundingClientRect().top < bounds.bottom) {
				index = this.#jumpedTo;
			}
			this.activeIndex = index;
		};
		const onScroll = () => (frame ||= requestAnimationFrame(update));
		// Scrolling by hand ends what the last jump pinned.
		const onUserScroll = () => (this.#jumpedTo = -1);
		const userEvents = ['wheel', 'touchmove', 'keydown'] as const;

		update();
		scroller.addEventListener('scroll', onScroll, { passive: true });
		for (const type of userEvents) scroller.addEventListener(type, onUserScroll, { passive: true });
		return () => {
			scroller.removeEventListener('scroll', onScroll);
			for (const type of userEvents) scroller.removeEventListener(type, onUserScroll);
			cancelAnimationFrame(frame);
		};
	}
}

export const pageToc = new PageToc();

/** The headings of a rendered editor, in document order. */
export function collectHeadings(editorRoot: HTMLElement): TocEntry[] {
	return [...editorRoot.querySelectorAll<HTMLElement>('.ProseMirror > :is(h1, h2, h3, h4)')]
		.map((element) => ({
			level: Number(element.tagName[1]),
			text: element.textContent?.trim() ?? '',
			element
		}))
		.filter((entry) => entry.text);
}

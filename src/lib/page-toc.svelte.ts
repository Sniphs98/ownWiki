import { browser } from '$app/environment';

export interface TocEntry {
	/** 1–4, from the heading's tag. */
	level: number;
	text: string;
	element: HTMLElement;
}

const EXPANDED_KEY = 'toc-expanded';

/**
 * The table of contents of the page that's open: the editor showing it
 * (markdown-editor.svelte, given a `tocPath`) publishes its headings here,
 * the page tree in the sidebar shows them under that page (page-toc.svelte).
 */
class PageToc {
	/** Wiki path of the page the entries belong to, or null. */
	path = $state<string | null>(null);
	entries = $state.raw<TocEntry[]>([]);
	/** Whether the table of contents is unfolded in the sidebar. Per browser. */
	expanded = $state(true);

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
	}

	toggle() {
		this.expanded = !this.expanded;
		try {
			localStorage.setItem(EXPANDED_KEY, String(this.expanded));
		} catch {
			// Not persisted; still applies until reload.
		}
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

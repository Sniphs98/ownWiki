import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';
import { openLinkQuery } from './link-suggestions';

/** A `[[…` being typed: what's typed, where it is, and where to show suggestions. */
export interface OpenLink {
	query: string;
	/** From the `[[` … */
	from: number;
	/** … to the cursor. */
	to: number;
	/** The line with the `[[`, in viewport pixels: the suggestions go below it, or above. */
	left: number;
	top: number;
	bottom: number;
}

export type SuggestKey = 'up' | 'down' | 'choose';

export interface LinkSuggestHandlers {
	/** The `[[…` being typed changed, or there is none (null). */
	onChange(open: OpenLink | null): void;
	/** A key while suggestions show; returns whether they used it. */
	onKey(key: SuggestKey): boolean;
}

function openLinkAt(view: EditorView): OpenLink | null {
	const { selection } = view.state;
	if (!selection.empty) return null;
	const { $from } = selection;
	// Code shows what's typed as it is.
	if ($from.parent.type.spec.code || $from.marks().some((mark) => mark.type.spec.code)) {
		return null;
	}
	const before = $from.parent.textBetween(
		Math.max(0, $from.parentOffset - 100),
		$from.parentOffset,
		undefined,
		// Stands in for inline nodes such as images.
		'\ufffc'
	);
	const found = openLinkQuery(before);
	if (!found) return null;
	const from = $from.pos - found.length;
	const coords = view.coordsAtPos(from);
	return {
		query: found.query,
		from,
		to: $from.pos,
		left: coords.left,
		top: coords.top,
		bottom: coords.bottom
	};
}

const KEYS: Record<string, SuggestKey | 'close'> = {
	ArrowDown: 'down',
	ArrowUp: 'up',
	Enter: 'choose',
	Tab: 'choose',
	Escape: 'close'
};

/**
 * Suggests pages while a `[[wiki link]]` is typed: reports the `[[…` at
 * the cursor to `handlers`, which show the suggestions, and hands them the
 * keys to pick one. Escape closes them until a new `[[` is typed.
 */
export function linkSuggest(handlers: LinkSuggestHandlers) {
	let open: OpenLink | null = null;
	let dismissedAt: number | null = null;

	const show = (next: OpenLink | null) => {
		open = next;
		handlers.onChange(next);
	};

	return $prose(
		() =>
			new Plugin({
				key: new PluginKey('link-suggest'),
				view: () => ({
					update(view) {
						const next = view.editable ? openLinkAt(view) : null;
						if (!next) dismissedAt = null;
						show(next && next.from !== dismissedAt ? next : null);
					},
					destroy: () => show(null)
				}),
				props: {
					handleDOMEvents: {
						// As a DOM handler, ahead of every keymap: Enter picks a page
						// here instead of starting a new paragraph.
						keydown(_view, event) {
							const key = open && !event.isComposing ? KEYS[event.key] : undefined;
							if (!open || !key) return false;
							if (key === 'close') {
								dismissedAt = open.from;
								show(null);
							} else if (!handlers.onKey(key)) {
								return false;
							}
							event.preventDefault();
							return true;
						}
					}
				}
			})
	);
}

/** Replaces the `[[…` being typed with a finished `[[text]]`. */
export function finishLink(view: EditorView, open: OpenLink, text: string) {
	view.dispatch(view.state.tr.insertText(`[[${text}]]`, open.from, open.to));
	view.focus();
}

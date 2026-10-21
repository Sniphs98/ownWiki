import { InputRule } from '@milkdown/kit/prose/inputrules';
import type { EditorState } from '@milkdown/kit/prose/state';
import { Plugin, TextSelection } from '@milkdown/kit/prose/state';
import { $inputRule, $prose } from '@milkdown/kit/utils';
import { insertImageInputRule, linkSchema } from '@milkdown/kit/preset/commonmark';
import { isWebAddress, trimWebAddress, TYPED_LINK, TYPED_WEB_ADDRESS } from './link-syntax';

/**
 * Markdown typed in the editor turns into what it stands for — Milkdown
 * does that for headings, lists, emphasis …, but not for links, and its
 * rule for images isn't switched on. A pasted web address already becomes
 * a link (Crepe's clipboard handling); these make typing one do the same.
 */

/** Inline code shows what's typed as it is. */
function inCode(state: EditorState, pos: number) {
	return state.doc
		.resolve(pos)
		.marks()
		.some((mark) => mark.type.spec.code);
}

/** `[Text](address)` → a link. */
const linkInputRule = $inputRule(
	(ctx) =>
		new InputRule(TYPED_LINK, (state, match, start, end) => {
			if (inCode(state, start)) return null;
			const [, text, href] = match;
			const link = linkSchema.type(ctx).create({ href });
			const marks = link.addToSet(state.doc.resolve(start).marks());
			return state.tr
				.replaceWith(start, end, state.schema.text(text, marks))
				.removeStoredMark(link.type);
		})
);

/** A web address and a space after it → the address becomes a link. */
const webAddressInputRule = $inputRule(
	(ctx) =>
		new InputRule(TYPED_WEB_ADDRESS, (state, match, start, end) => {
			const address = trimWebAddress(match[1]);
			const linkType = linkSchema.type(ctx);
			const addressEnd = start + address.length;
			if (!address || inCode(state, start) || state.doc.rangeHasMark(start, addressEnd, linkType)) {
				return null;
			}
			const tr = state.tr.addMark(start, addressEnd, linkType.create({ href: address }));
			// The space typed after it, and whatever comes next, isn't part of the link.
			const marks = linkType.removeFromSet(tr.doc.resolve(end).marks());
			return tr.insert(end, state.schema.text(match[0].slice(-1), marks));
		})
);

/** A web address pasted over selected text links that text instead of replacing it. */
const pasteLinkOverSelection = $prose(
	(ctx) =>
		new Plugin({
			props: {
				handleDOMEvents: {
					// Before Crepe's own paste handling, which would replace the text.
					paste: (view, event) => {
						const text = event.clipboardData?.getData('text/plain').trim() ?? '';
						const { selection } = view.state;
						if (
							!view.editable ||
							selection.empty ||
							!(selection instanceof TextSelection) ||
							selection.$from.parent.type.spec.code ||
							!isWebAddress(text)
						) {
							return false;
						}
						const link = linkSchema.type(ctx).create({ href: text });
						view.dispatch(view.state.tr.addMark(selection.from, selection.to, link));
						event.preventDefault();
						return true;
					}
				}
			}
		})
);

export const editorInputRules = [
	insertImageInputRule,
	linkInputRule,
	webAddressInputRule,
	pasteLinkOverSelection
];

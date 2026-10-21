/**
 * Links written in the editor: `[Text](address)` and plain web addresses.
 * Used by the editor's input rules (editor-input-rules.ts).
 */

/** `[Text](address)` just typed, up to its closing parenthesis — `![…](…)` is an image. */
export const TYPED_LINK = /(?<!!)\[([^[\]]+)\]\(([^()\s]+)\)$/;

/** A web address, followed by the space or punctuation just typed after it. */
export const TYPED_WEB_ADDRESS = /(?<=^|\s)(https?:\/\/\S+)\s$/;

const TRAILING_PUNCTUATION = '.,:;!?\'"';

const count = (text: string, char: string) => text.split(char).length - 1;

/**
 * The web address in `text`, without punctuation that ends the sentence
 * rather than the address ("siehe https://example.org." → without the
 * dot). A closing parenthesis stays when the address opened one, as in
 * https://de.wikipedia.org/wiki/Ticket_(Begriff). Empty if there's no
 * address left.
 */
export function trimWebAddress(text: string): string {
	let address = text;
	for (;;) {
		const last = address.at(-1) ?? '';
		const unbalanced = last === ')' && count(address, ')') > count(address, '(');
		if (!TRAILING_PUNCTUATION.includes(last) && !unbalanced) break;
		address = address.slice(0, -1);
	}
	return isWebAddress(address) ? address : '';
}

/** Whether `text` is one web address and nothing else. */
export function isWebAddress(text: string): boolean {
	return /^https?:\/\/[^\s/?#.]+(?:\.[^\s/?#.]+)*(?::\d+)?(?:[/?#]\S*)?$/.test(text);
}

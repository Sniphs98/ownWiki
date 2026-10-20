/**
 * Code in markdown — fenced blocks and inline `code` spans — is shown as
 * written, so text transformations (wiki links, search text) must leave
 * it alone: `if [[ -f "$file" ]]` in a shell snippet is not a wiki link.
 */

/** An opening fence and its info string ("```bash" → marker "```", info "bash"). */
export function fenceOpening(line: string): { marker: string; info: string } | null {
	// Any indentation: Milkdown indents fences that sit inside list items.
	const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
	if (!match) return null;
	const [, marker, rest] = match;
	// A backtick fence's info string can't contain backticks (CommonMark).
	if (marker[0] === '`' && rest.includes('`')) return null;
	return { marker, info: rest.trim() };
}

/**
 * Whether `line` closes a block opened with `marker`: the same character,
 * at least as many, and nothing after it — "```js" inside a "````" block
 * is content, not the end of the block.
 */
export function closesFence(line: string, marker: string): boolean {
	const match = line.match(/^\s*(`{3,}|~{3,})\s*$/);
	return !!match && match[1][0] === marker[0] && match[1].length >= marker.length;
}

/**
 * An inline code span: a run of backticks up to the next run of the same
 * length, within one paragraph (no blank line in between).
 */
const INLINE_CODE = /(?<![`\\])(`+)(?!`)(?:(?!\n\s*\n)[\s\S])*?(?<!`)\1(?!`)/g;

/** Applies `transform` to every part of `markdown` that isn't code. */
export function transformOutsideCode(markdown: string, transform: (text: string) => string) {
	const out: string[] = [];
	let text: string[] = [];
	let fence: string | null = null;

	const flushText = () => {
		if (text.length === 0) return;
		const joined = text.join('\n');
		let last = 0;
		let result = '';
		for (const match of joined.matchAll(INLINE_CODE)) {
			result += transform(joined.slice(last, match.index)) + match[0];
			last = match.index + match[0].length;
		}
		out.push(result + transform(joined.slice(last)));
		text = [];
	};

	for (const line of markdown.split('\n')) {
		if (fence) {
			out.push(line);
			if (closesFence(line, fence)) fence = null;
			continue;
		}
		const opening = fenceOpening(line);
		if (opening) {
			flushText();
			out.push(line);
			fence = opening.marker;
			continue;
		}
		text.push(line);
	}
	flushText();
	return out.join('\n');
}

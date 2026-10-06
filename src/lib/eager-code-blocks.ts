/**
 * Crepe renders code blocks lazily: a plain <pre> placeholder until the
 * block scrolls near the viewport (IntersectionObserver), then the real
 * CodeMirror view — with line numbers, syntax highlighting and a toolbar,
 * ~50px taller — and back to the placeholder 5 s after it scrolls away.
 * There is no option to turn that off (@milkdown/components 7.22).
 *
 * That breaks the PDF promise twice: the off-screen print view only ever
 * gets placeholders, so the PDF looks different from the page; and the page
 * itself changes height while scrolling, so page-break markers drift.
 *
 * This wraps IntersectionObserver so that Crepe code blocks always count as
 * visible: they're reported as intersecting as soon as they're observed,
 * and "left the viewport" entries for them are dropped. Every other use of
 * IntersectionObserver is untouched.
 */
const CODE_BLOCK_CLASS = 'milkdown-code-block';

let installed = false;

export function installEagerCodeBlocks() {
	if (installed || typeof IntersectionObserver === 'undefined') return;
	installed = true;

	const isCodeBlock = (el: Element) => el.classList.contains(CODE_BLOCK_CLASS);

	class EagerCodeBlockObserver extends IntersectionObserver {
		#callback: IntersectionObserverCallback;

		constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
			super((entries, observer) => {
				const kept = entries.filter((entry) => entry.isIntersecting || !isCodeBlock(entry.target));
				if (kept.length > 0) callback(kept, observer);
			}, options);
			this.#callback = callback;
		}

		observe(target: Element) {
			super.observe(target);
			if (!isCodeBlock(target)) return;
			// Crepe only reads target and isIntersecting from the entry.
			const entry = { target, isIntersecting: true } as IntersectionObserverEntry;
			queueMicrotask(() => this.#callback([entry], this));
		}
	}

	window.IntersectionObserver = EagerCodeBlockObserver;
}

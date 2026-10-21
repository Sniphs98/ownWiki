/**
 * Crepe's "/" menu highlights the item the mouse enters. The arrow keys
 * scroll its list, and with the mouse resting over the menu the browser
 * then reports the item that scrolled under it: the highlight jumps, and
 * Enter inserts something else than what was highlighted a moment ago.
 * (Crepe only ignores that once the mouse has moved inside the menu.)
 *
 * Lets the menu see the mouse enter an item only when the mouse moved.
 * Returns a function that removes the guard.
 */
export function guardSlashMenuHover(root: HTMLElement): () => void {
	let pointer: { x: number; y: number } | null = null;

	const onPointerMove = (event: PointerEvent) => {
		pointer = { x: event.clientX, y: event.clientY };
	};
	const onPointerEnter = (event: PointerEvent) => {
		const resting = pointer?.x === event.clientX && pointer.y === event.clientY;
		const inMenu = event.target instanceof Element && event.target.closest('.milkdown-slash-menu');
		// Capturing on the way down, so the item's own listener never sees it.
		if (resting && inMenu) event.stopPropagation();
	};

	window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
	root.addEventListener('pointerenter', onPointerEnter, { capture: true });
	return () => {
		window.removeEventListener('pointermove', onPointerMove, { capture: true });
		root.removeEventListener('pointerenter', onPointerEnter, { capture: true });
	};
}

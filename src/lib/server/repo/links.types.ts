/** A link target as written (see linkTargets) and the page it's bound to, if any yet. */
export interface BoundLink {
	target: string;
	pageId: string | null;
}

/** A link with the page it's on. */
export interface StoredLink extends BoundLink {
	fromPageId: string;
}

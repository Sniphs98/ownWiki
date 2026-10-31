import { transformOutsideCode } from './markdown-code';

/** A link or image in markdown to a path on this server: `](/…`, not `](//host…`. */
const ROOT_LINK = /\]\(\/(?!\/)/g;

/**
 * Pages are stored with their links to the wiki as root paths
 * (`/w/…`, `/api/files/…`), so they don't depend on where the wiki is
 * served. Shown or edited under a base path (BASE_PATH, e.g. /wiki), they
 * get it in front: `](/w/hr)` → `](/wiki/w/hr)`. Code stays as written.
 */
export function addBasePath(markdown: string, base: string): string {
	if (!base) return markdown;
	return transformOutsideCode(markdown, (text) => text.replace(ROOT_LINK, `](${base}/`));
}

/** The reverse of addBasePath, for what the editor saves. */
export function removeBasePath(markdown: string, base: string): string {
	if (!base) return markdown;
	const prefixed = new RegExp(`\\]\\(${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`, 'g');
	return transformOutsideCode(markdown, (text) => text.replace(prefixed, '](/'));
}

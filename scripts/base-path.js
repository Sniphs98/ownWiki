// The path the wiki is served under, behind a reverse proxy: BASE_PATH,
// e.g. "/wiki" for https://example.org/wiki. Set when the server starts —
// not when it's built — so one image serves any path. The production build
// carries this placeholder wherever SvelteKit put its base path; start.js
// writes the real one in its place.

/** @type {`/${string}`} */
export const BASE_PLACEHOLDER = '/__wiki_base_path__';

/**
 * BASE_PATH as SvelteKit wants a base path: "" for the root, otherwise
 * starting with "/" and without a trailing one. Throws for anything that
 * isn't a plain path.
 * @param {string | undefined} value
 * @returns {'' | `/${string}`}
 */
export function normalizeBasePath(value) {
	const trimmed = (value ?? '').trim().replace(/\/+$/, '');
	if (!trimmed) return '';
	/** @type {`/${string}`} */
	const path = trimmed.startsWith('/') ? /** @type {`/${string}`} */ (trimmed) : `/${trimmed}`;
	if (!/^(\/[A-Za-z0-9._~-]+)+$/.test(path)) {
		throw new Error(
			`BASE_PATH "${value}" is not a plain path such as "/wiki" (letters, digits, ".", "_", "~", "-")`
		);
	}
	return path;
}

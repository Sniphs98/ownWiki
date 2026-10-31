/**
 * The path to send someone to after logging in, taken from ?redirectTo=.
 * Only paths on this wiki: "//evil.example" or "/\evil.example" also start
 * with a slash, but browsers treat them as links to another site.
 */
export function safeRedirectPath(
	target: string | null | undefined,
	origin: string,
	/** Where to go instead: the start page, under the base path if there is one. */
	fallback = '/'
): string {
	if (!target?.startsWith('/')) return fallback;
	try {
		const url = new URL(target, origin);
		if (url.origin !== origin) return fallback;
		return url.pathname + url.search + url.hash;
	} catch {
		return fallback;
	}
}

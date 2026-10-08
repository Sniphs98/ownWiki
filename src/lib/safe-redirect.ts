/**
 * The path to send someone to after logging in, taken from ?redirectTo=.
 * Only paths on this wiki: "//evil.example" or "/\evil.example" also start
 * with a slash, but browsers treat them as links to another site.
 */
export function safeRedirectPath(target: string | null | undefined, origin: string): string {
	if (!target?.startsWith('/')) return '/';
	try {
		const url = new URL(target, origin);
		if (url.origin !== origin) return '/';
		return url.pathname + url.search + url.hash;
	} catch {
		return '/';
	}
}

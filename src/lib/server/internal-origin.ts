import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

/**
 * The server's address for requests it sends to itself (the PDF generator's
 * browser, the MCP endpoint fetching its signing keys). They run in the same
 * process/container, so a loopback URL is always reachable — unlike
 * the app's public origin, which may be unset, or sit behind a proxy/DNS
 * name this container can't resolve to itself.
 */
export function internalOrigin(requestUrl: URL): string {
	// The Vite dev server picks its own port (5173, or the next free one) and
	// doesn't expose it via PORT — but in dev the request URL is the dev
	// server itself, reachable from this machine.
	if (dev) return requestUrl.origin;

	// adapter-node listens on PORT, defaulting to 3000. Not 127.0.0.1: some
	// setups bind only the IPv6 loopback (::1), which refuses IPv4
	// connections outright; "localhost" resolves correctly either way.
	return `http://localhost:${env.PORT || '3000'}`;
}

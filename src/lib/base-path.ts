import { base } from '$app/paths';

/**
 * The path the wiki is served under: '' at the root, or e.g. '/wiki' behind
 * a reverse proxy (BASE_PATH, written in at start by scripts/start.js).
 * Links in components use resolve() from $app/paths; this is for the rest —
 * redirects, fetch calls, and URLs built on the server.
 */
export const basePath: string = base;

/** A path on this wiki, under its base path: '/api/pins' → '/wiki/api/pins'. */
export const withBase = (path: `/${string}`) => `${basePath}${path}`;

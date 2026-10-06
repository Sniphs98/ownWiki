import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import type { RequestHandler } from './$types';

/**
 * Serves Excalidraw's font files straight from the installed package
 * (see useLocalExcalidrawAssets in $lib/diagrams/render.ts), so drawings
 * don't make the browser fetch fonts from a public CDN.
 */
const assetRoot = dirname(createRequire(import.meta.url).resolve('@excalidraw/excalidraw'));

const CONTENT_TYPES: Record<string, string> = {
	woff2: 'font/woff2',
	woff: 'font/woff',
	ttf: 'font/ttf'
};

export const GET: RequestHandler = async ({ params }) => {
	const file = resolve(assetRoot, params.file);
	const contentType = CONTENT_TYPES[file.split('.').pop() ?? ''];
	// Only font files below the package's fonts/ directory.
	if (!contentType || !file.startsWith(resolve(assetRoot, 'fonts') + sep)) error(404);

	const data = await readFile(file).catch(() => error(404));
	return new Response(new Uint8Array(data), {
		headers: {
			'content-type': contentType,
			// File names carry a content hash.
			'cache-control': 'public, max-age=31536000, immutable'
		}
	});
};

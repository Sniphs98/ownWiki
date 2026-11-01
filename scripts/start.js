// Starts the built server (build/) under BASE_PATH. The build carries a
// placeholder for its base path (see base-path.js and vite.config.ts); this
// copies it and writes the real path in, then runs the copy. The copy stays
// inside the project, so the server still finds node_modules.
//
// RUNTIME_DIR: where the copy goes, default .runtime/<PORT> (one per port,
// so several servers can start from the same build).
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BASE_PLACEHOLDER, normalizeBasePath } from './base-path.js';

const basePath = normalizeBasePath(process.env.BASE_PATH);
const source = resolve('build');
const target = resolve(process.env.RUNTIME_DIR || join('.runtime', process.env.PORT || '3000'));

// Text files that may name the base path; the rest (images, fonts, wasm) are copied as they are.
const TEXT = /\.(?:js|mjs|cjs|json|html|css|svg|txt|webmanifest|map)$/;

function rewrite(dir) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) rewrite(path);
		else if (TEXT.test(name)) {
			const text = readFileSync(path, 'utf8');
			if (text.includes(BASE_PLACEHOLDER)) {
				writeFileSync(path, text.replaceAll(BASE_PLACEHOLDER, basePath));
			}
		}
	}
}

/**
 * Copies the build, with the browser's files (in client/__wiki_base_path__/
 * in the build) straight to where the base path puts them. Copied, not
 * moved after copying: on Windows, a virus scanner holding a freshly copied
 * file makes renaming its folder fail.
 */
function copyBuild() {
	const placeholder = join(source, 'client', BASE_PLACEHOLDER.slice(1));
	cpSync(source, target, { recursive: true, filter: (path) => path !== placeholder });
	if (existsSync(placeholder)) {
		const final = join(target, 'client', ...basePath.split('/').filter(Boolean));
		mkdirSync(final, { recursive: true });
		cpSync(placeholder, final, { recursive: true });
	}
}

rmSync(target, { recursive: true, force: true, maxRetries: 5 });
copyBuild();
rewrite(target);
console.log(`[start] serving under "${basePath || '/'}" from ${target}`);

await import(pathToFileURL(join(target, 'index.js')).href);

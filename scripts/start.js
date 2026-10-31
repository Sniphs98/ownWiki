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
	renameSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

/** The browser's files sit in a folder named like the base path: client/__ownwiki_base_path__/. */
function moveClientFiles() {
	const client = join(target, 'client');
	const placeholder = join(client, BASE_PLACEHOLDER.slice(1));
	if (!existsSync(placeholder)) return;
	if (basePath) {
		const final = join(client, ...basePath.split('/').filter(Boolean));
		mkdirSync(dirname(final), { recursive: true });
		renameSync(placeholder, final);
	} else {
		for (const name of readdirSync(placeholder))
			renameSync(join(placeholder, name), join(client, name));
		rmSync(placeholder, { recursive: true });
	}
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
rewrite(target);
moveClientFiles();
console.log(`[start] serving under "${basePath || '/'}" from ${target}`);

await import(pathToFileURL(join(target, 'index.js')).href);

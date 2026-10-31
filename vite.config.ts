import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { BASE_PLACEHOLDER, normalizeBasePath } from './scripts/base-path.js';

export default defineConfig(({ command }) => ({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			paths: {
				// Behind a reverse proxy under a path, e.g. /wiki. A build doesn't
				// know it yet: scripts/start.js writes BASE_PATH over this
				// placeholder when the server starts. The dev server takes it as is.
				base: command === 'build' ? BASE_PLACEHOLDER : normalizeBasePath(process.env.BASE_PATH)
			},
			// Checked in hooks.server.ts instead (src/lib/server/csrf.ts), which
			// can let AI assistants' servers reach the OAuth token endpoint.
			csrf: { trustedOrigins: ['*'] },
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.spec.js'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
}));
